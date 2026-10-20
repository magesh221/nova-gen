"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    createConversation,
    getConversationMessages,
    regenerateMessage,
    sendConversationMessage,
    stopGeneration,
    type ChatMessage,
    type StoredMessage,
} from "@/app/services/api";
import { useAuth } from "@/app/context/AuthContext";
import { useConversations } from "@/app/context/ConversationContext";
import { signInRequiredUrl } from "@/app/services/redirects";
import MarkdownMessage from "@/app/components/MarkdownMessage";
import SideBar from "@/app/components/SideBar";
import { suggestions } from "@/app/components/DummyDatas";

type ChatItem = StoredMessage & { clientMessageId?: string };

function localMessage(role: ChatMessage["role"], content: string, id = crypto.randomUUID()): ChatItem {
    const now = new Date().toISOString();
    return { _id: id, role, content, status: role === "user" ? "completed" : "pending", model: null, createdAt: now, updatedAt: now };
}

type ChatUIProps = { conversationId?: string };

export default function ChatUI({ conversationId }: ChatUIProps) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { reload: reloadConversations } = useConversations();
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [error, setError] = useState("");
    const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
    const [localConversationId, setLocalConversationId] = useState<string | null>(conversationId || null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const activeAssistantIdRef = useRef<string | null>(null);
    const authenticatedUserIdRef = useRef<string | null>(null);
    const activeConversationId = conversationId || localConversationId;

    useEffect(() => {
        authenticatedUserIdRef.current = user?.id || null;
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            // Drop cached chat data immediately when the cookie session expires or signs out.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMessages([]);
            setNextMessageCursor(null);
            setLocalConversationId(null);
            router.replace(signInRequiredUrl(`${window.location.pathname}${window.location.search}`));
            return;
        }
        if (!conversationId) {
            // Reset route-scoped state when navigation moves back to the new-chat route.
            setLocalConversationId(null);
            setMessages([]);
            setNextMessageCursor(null);
            return;
        }
        let cancelled = false;
        setMessages([]);
        setLoadingHistory(true);
        setError("");
        void (async () => {
            try {
                const page = await getConversationMessages(conversationId);
                if (cancelled) return;
                setMessages(page.items);
                setNextMessageCursor(page.nextCursor);
            } catch (reason: unknown) {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load this conversation.");
            } finally {
                if (!cancelled) setLoadingHistory(false);
            }
        })();
        return () => { cancelled = true; };
    }, [authLoading, conversationId, router, user]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        const prompt = sessionStorage.getItem("novaPrompt");
        if (prompt) {
            sessionStorage.removeItem("novaPrompt");
            // This one-time navigation prompt initializes the controlled input.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setInput(prompt);
        }
    }, []);

    const appendAssistantDelta = useCallback((assistantId: string, content: string) => {
        setMessages((current) => {
            const existing = current.find((item) => item._id === assistantId);
            if (existing) return current.map((item) => item._id === assistantId ? { ...item, content: item.content + content } : item);
            return [...current, localMessage("assistant", content, assistantId)];
        });
    }, []);

    function handleNewChat() {
        if (loading) return;
        setMessages([]);
        setLocalConversationId(null);
        setNextMessageCursor(null);
        setInput("");
        setError("");
        router.push("/chatbot");
    }

    async function handleSend(event?: FormEvent<HTMLFormElement>) {
        event?.preventDefault();
        if (!user || authLoading || loading || loadingHistory) return;
        authenticatedUserIdRef.current = user.id;
        const text = input.trim();
        if (!text) return;

        const userMessage = localMessage("user", text);
        const clientMessageId = crypto.randomUUID();
        const updatedMessages = [...messages, { ...userMessage, clientMessageId }];
        setMessages(updatedMessages);
        setInput("");
        setError("");
        setActiveAssistantId(null);
        activeAssistantIdRef.current = null;
        setLoading(true);
        let createdConversationId: string | null = null;
        let sessionExpired = false;

        try {
            let targetConversationId = activeConversationId;
            if (!targetConversationId) {
                const conversation = await createConversation(text.slice(0, 120));
                targetConversationId = conversation._id;
                createdConversationId = conversation._id;
                setLocalConversationId(conversation._id);
            }

            const response = await sendConversationMessage(targetConversationId, {
                content: text,
                clientMessageId,
            }, {
                onStart: (assistantId) => {
                    activeAssistantIdRef.current = assistantId;
                    setActiveAssistantId(assistantId);
                    setMessages((current) => current.some((item) => item._id === assistantId)
                        ? current
                        : [...current, localMessage("assistant", "", assistantId)]);
                },
                onDelta: (delta) => {
                    const assistantId = activeAssistantIdRef.current || undefined;
                    if (assistantId) appendAssistantDelta(assistantId, delta);
                },
            });

            setMessages((current) => {
                const assistant = response.assistantMessage;
                const found = current.some((item) => item._id === assistant._id);
                if (found) return current.map((item) => item._id === assistant._id ? assistant : item);
                return [...current, assistant];
            });
        } catch (reason: unknown) {
            sessionExpired = Boolean(reason && typeof reason === "object" && "code" in reason && ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(String(reason.code)));
            if (sessionExpired) authenticatedUserIdRef.current = null;
            setError(reason instanceof Error ? reason.message : "Unable to get a response. Please try again.");
            const failedMessage = reason && typeof reason === "object" && "assistantMessage" in reason
                ? (reason as { assistantMessage?: StoredMessage }).assistantMessage
                : undefined;
            if (failedMessage) {
                setMessages((current) => current.map((item) => item._id === failedMessage._id ? failedMessage : item));
            }
        } finally {
            setLoading(false);
            setActiveAssistantId(null);
            activeAssistantIdRef.current = null;
            if (!sessionExpired && authenticatedUserIdRef.current === user.id) {
                await reloadConversations();
                if (createdConversationId && authenticatedUserIdRef.current === user.id) router.replace(`/chatbot/${createdConversationId}`);
            }
        }
    }

    async function loadEarlierMessages() {
        if (!activeConversationId || !nextMessageCursor || loadingHistory) return;
        const scroller = scrollRef.current;
        const oldHeight = scroller?.scrollHeight || 0;
        setLoadingHistory(true);
        try {
            const page = await getConversationMessages(activeConversationId, nextMessageCursor);
            setMessages((current) => [...page.items, ...current]);
            setNextMessageCursor(page.nextCursor);
            requestAnimationFrame(() => {
                if (scroller) scroller.scrollTop = scroller.scrollHeight - oldHeight;
            });
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to load earlier messages.");
        } finally {
            setLoadingHistory(false);
        }
    }

    async function stopCurrentGeneration() {
        if (!activeConversationId || !activeAssistantId) return;
        try { await stopGeneration(activeConversationId, activeAssistantId); }
        catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Unable to stop this response."); }
    }

    async function retryResponse(messageId: string) {
        if (!activeConversationId || loading) return;
        setLoading(true);
        setError("");
        setActiveAssistantId(null);
        activeAssistantIdRef.current = null;
        try {
            const assistant = await regenerateMessage(activeConversationId, messageId, {
                onStart: (assistantId) => {
                    activeAssistantIdRef.current = assistantId;
                    setActiveAssistantId(assistantId);
                    setMessages((current) => [...current, localMessage("assistant", "", assistantId)]);
                },
                onDelta: (delta) => {
                    const assistantId = activeAssistantIdRef.current;
                    if (assistantId) appendAssistantDelta(assistantId, delta);
                },
            });
            setMessages((current) => {
                const found = current.some((item) => item._id === assistant._id);
                return found ? current.map((item) => item._id === assistant._id ? assistant : item) : [...current, assistant];
            });
            await reloadConversations();
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to regenerate the response.");
        } finally {
            setLoading(false);
            setActiveAssistantId(null);
            activeAssistantIdRef.current = null;
        }
    }

    async function copyMessage(message: ChatItem) {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopiedMessageId(message._id);
            window.setTimeout(() => setCopiedMessageId(null), 1500);
        } catch { setError("Clipboard access is unavailable in this browser."); }
    }

    if (authLoading) return <main className="flex h-dvh items-center justify-center bg-[#f8faff] text-sm text-slate-500">Checking your Nova AI session...</main>;
    if (!user) return <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#f8faff] px-6 text-center"><h1 className="text-xl font-bold">Please sign in to start chatting with Nova AI.</h1><Link href="/sign-in" className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Sign in</Link></main>;

    return (
        <main className="flex h-dvh overflow-hidden bg-[#f8faff]">
            <div className="hidden md:block"><SideBar onNewChat={handleNewChat} /></div>

            {mobileMenu && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="h-full"><SideBar onNewChat={handleNewChat} onClose={() => setMobileMenu(false)} /></div>
                    <button aria-label="Close navigation" onClick={() => setMobileMenu(false)} className="flex-1 bg-slate-950/30" />
                </div>
            )}

            <section className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileMenu(true)} aria-label="Open navigation" className="rounded-lg p-2 text-xl hover:bg-slate-100 md:hidden">☰</button>
                        <div><h1 className="font-bold">Nova AI</h1><p className="text-xs text-slate-500">Signed in as {user.name}</p></div>
                    </div>
                    {user ? <Link href="/settings" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Account</Link> : <Link href="/sign-in" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Sign In</Link>}
                </header>

                <div ref={scrollRef} className="chat-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                    <div className="mx-auto max-w-3xl">
                        {loadingHistory && messages.length === 0 ? <div className="space-y-4"><div className="h-20 animate-pulse rounded-2xl bg-slate-200" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /></div> : messages.length === 0 ? (
                            <div className="flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
                                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 text-3xl text-white shadow-lg shadow-blue-500/20">✳</div>
                                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How can I help?</h2>
                                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">Ask me anything. We can solve problems, explore ideas, or work through code together.</p>
                                <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                                    {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-medium transition hover:border-blue-300 hover:bg-blue-50/50"><span className="mb-3 block text-lg text-blue-600">↗</span>{suggestion}</button>)}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-7 pb-6">
                                {nextMessageCursor && <div className="text-center"><button onClick={() => void loadEarlierMessages()} disabled={loadingHistory} className="rounded-lg px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50">{loadingHistory ? "Loading..." : "Load earlier messages"}</button></div>}
                                {messages.map((message) => (
                                    <article key={message._id} className={`group flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                        {message.role === "assistant" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg text-white">✳</div>}
                                        <div className="max-w-[90%] min-w-0 sm:max-w-[78%]">
                                            <div className={`rounded-2xl px-4 py-3.5 text-sm leading-7 ${message.role === "user" ? "whitespace-pre-wrap rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
                                                {message.role === "assistant" ? message.content ? <MarkdownMessage content={message.content} /> : message.status === "pending" ? <span className="animate-pulse text-slate-400">Thinking...</span> : <span className="text-slate-400">No response was generated.</span> : message.content}
                                            </div>
                                            {message.role === "assistant" && message.status !== "pending" && <div className="mt-1 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                                <button onClick={() => void copyMessage(message)} className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700">{copiedMessageId === message._id ? "Copied" : "Copy"}</button>
                                                {user && message.status === "completed" && <button onClick={() => void retryResponse(message._id)} disabled={loading} className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">Regenerate</button>}
                                                {user && message.status === "failed" && <button onClick={() => void retryResponse(message._id)} disabled={loading} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50">Retry</button>}
                                            </div>}
                                        </div>
                                        {message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-semibold text-violet-700">{user?.name.slice(0, 1).toUpperCase() || "G"}</div>}
                                    </article>
                                ))}
                                {loading && !activeAssistantId && <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">✳</div><div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-400 animate-pulse">Thinking...</div></div>}
                                <div ref={bottomRef} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 bg-gradient-to-t from-[#f8faff] via-[#f8faff] to-transparent px-4 pb-4 pt-3 sm:px-8">
                    <div className="mx-auto max-w-3xl">
                        {error && <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
                        <form onSubmit={(event) => void handleSend(event)} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/50 focus-within:border-blue-300">
                            <textarea disabled={loading || loadingHistory} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder="Message Nova AI..." rows={2} className="max-h-40 min-h-[52px] w-full resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-60" />
                            <div className="flex items-center justify-between px-1 pt-2">
                                <span className="text-xs text-slate-400">Enter to send · Shift + Enter for a new line</span>
                                {loading && activeAssistantId ? <button type="button" onClick={() => void stopCurrentGeneration()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Stop generating</button> : <button type="submit" disabled={!input.trim() || loading || loadingHistory} aria-label="Send message" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">↑</button>}
                            </div>
                        </form>
                        <p className="mt-3 text-center text-xs text-slate-400">AI can make mistakes. Check important information.</p>
                    </div>
                </div>
            </section>
        </main>
    );
}
