"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useConversations } from "@/app/context/ConversationContext";
import type { Conversation } from "@/app/services/api";

const NO_CONVERSATIONS: Conversation[] = [];

type SideBarProps = {
    onNewChat?: () => void;
    onClose?: () => void;
};

function historyGroup(dateValue: string) {
    const date = new Date(dateValue);
    const now = new Date();
    const dayNumber = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    const daysAgo = Math.floor((dayNumber(now) - dayNumber(date)) / 86_400_000);
    if (daysAgo <= 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    if (daysAgo <= 7) return "Previous 7 days";
    return "Older";
}

function updatedLabel(dateValue: string) {
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export default function SideBar({ onNewChat, onClose }: SideBarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { conversations, loading, error, nextCursor, loadMore, search, rename, remove } = useConversations();
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
    const [actionError, setActionError] = useState("");
    const activeId = pathname.match(/^\/chatbot\/([^/]+)/)?.[1];

    useEffect(() => {
        const text = query.trim();
        if (text.length < 2) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void search(text).then((results) => {
                if (!cancelled) setSearchResults(results);
            }).catch((reason: unknown) => {
                if (!cancelled) setActionError(reason instanceof Error ? reason.message : "Search failed.");
            });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, search]);

    const shownConversations = !user ? NO_CONVERSATIONS : query.trim().length >= 2 ? searchResults || NO_CONVERSATIONS : conversations;
    const grouped = useMemo(() => shownConversations.reduce<Record<string, Conversation[]>>((groups, item) => {
        const group = historyGroup(item.lastMessageAt || item.updatedAt);
        (groups[group] ||= []).push(item);
        return groups;
    }, {}), [shownConversations]);

    function startNewChat() {
        if (onNewChat) onNewChat();
        else router.push("/chatbot");
        onClose?.();
    }

    async function handleRename(item: Conversation) {
        const title = window.prompt("Rename conversation", item.title);
        if (title === null || !title.trim()) return;
        setActionError("");
        try { await rename(item._id, title); }
        catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "Rename failed."); }
    }

    async function handleDelete(item: Conversation) {
        if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
        setActionError("");
        try {
            await remove(item._id);
            if (activeId === item._id) router.replace("/chatbot");
        } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "Delete failed."); }
    }

    async function handleSignOut() {
        setActionError("");
        try {
            await signOut();
            router.replace("/");
            onClose?.();
        } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "Sign out failed."); }
    }

    return (
        <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
            <Link href="/" onClick={onClose} className="mb-5 flex items-center gap-3 px-2 py-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white">✳</span>
                <span className="text-xl font-bold tracking-tight">Nova<span className="text-blue-600"> AI</span></span>
            </Link>

            <button onClick={startNewChat} className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700">
                <span className="text-lg">＋</span> New Chat
            </button>
            <Link href="/" onClick={onClose} className={`mb-3 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${pathname === "/" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
                <span className="text-xl">⌂</span> Dashboard
            </Link>

            <div className="mb-2 flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Your conversations</h2>
                {loading && <span className="text-xs text-slate-400">Loading</span>}
            </div>
            {user && (
                <label className="mb-3 block">
                    <span className="sr-only">Search conversations</span>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </label>
            )}

            <div className="chat-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto">
                {!user && <p className="px-2 py-2 text-sm leading-6 text-slate-400">Sign in to save and search your conversations.</p>}
                {user && error && <p role="alert" className="px-2 text-xs text-red-600">{error}</p>}
                {actionError && <p role="alert" className="px-2 text-xs text-red-600">{actionError}</p>}
                {user && !loading && shownConversations.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">{query.trim().length >= 2 ? "No matching chats." : "Your chats will appear here."}</p>}

                {(["Today", "Yesterday", "Previous 7 days", "Older"] as const).map((group) => grouped[group]?.length ? (
                    <section key={group}>
                        <h3 className="mb-1 px-2 text-xs font-semibold text-slate-400">{group}</h3>
                        <ul className="space-y-1">
                            {grouped[group].map((item) => (
                                <li key={item._id} className={`group flex items-center gap-1 rounded-lg ${activeId === item._id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                                    <button onClick={() => { router.push(`/chatbot/${item._id}`); onClose?.(); }} className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm ${activeId === item._id ? "font-semibold text-blue-700" : "text-slate-600"}`} title={`${item.title} · ${updatedLabel(item.updatedAt)}`}>
                                        <span className="block truncate">{item.title}</span>
                                        <span className="mt-0.5 block text-[11px] text-slate-400">{updatedLabel(item.updatedAt)}</span>
                                    </button>
                                    <details className="relative mr-1 shrink-0">
                                        <summary aria-label={`Actions for ${item.title}`} className="cursor-pointer list-none rounded-md px-2 py-1 text-slate-400 hover:bg-white hover:text-slate-700">⋯</summary>
                                        <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                            <button onClick={() => void handleRename(item)} className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-50">Rename</button>
                                            <button onClick={() => void handleDelete(item)} className="w-full rounded px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">Delete</button>
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null)}
                {user && !query.trim() && nextCursor && <button onClick={() => void loadMore()} disabled={loading} className="w-full rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50">Load more chats</button>}
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-4">
                <div className="mb-2 text-2xl">🤖</div>
                <p className="font-semibold text-slate-800">Your AI companion</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Ask questions, explore ideas, and get help with your work.</p>
            </div>

            {user ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                    <Link href="/settings" onClick={onClose} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 hover:bg-slate-50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{user.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-slate-400">{user.email}</span></span>
                    </Link>
                    <button onClick={() => void handleSignOut()} aria-label="Sign out" title="Sign out" className="rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100">↪</button>
                </div>
            ) : (
                <Link href="/sign-in" onClick={onClose} className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold hover:bg-slate-50">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">G</span> Sign in to save chats
                </Link>
            )}
        </aside>
    );
}
