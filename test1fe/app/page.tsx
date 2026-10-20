
"use client";

import { useState } from "react";
import Link from "next/link";
import { prompts } from "./components/DummyDatas";
import SideBar from "./components/SideBar";
import { useRouter } from "next/navigation";
import { useAuth } from "./context/AuthContext";
import { useConversations } from "./context/ConversationContext";



export default function Dashboard() {
  const [mobileMenu, setMobileMenu] = useState(false);
    const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { conversations, loading: conversationsLoading } = useConversations();


  function openPrompt(prompt: string) {
    sessionStorage.setItem("novaPrompt", prompt);
    router.push("/chatbot");
  }

  return (
    <main className="min-h-screen bg-[#f8faff]">
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <SideBar />
        </div>

        {mobileMenu && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="h-full">
              <SideBar onClose={() => setMobileMenu(false)} />
            </div>
            <button
              aria-label="Close navigation"
              onClick={() => setMobileMenu(false)}
              className="flex-1 bg-slate-950/30"
            />
          </div>
        )}

        <section className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenu(true)}
                className="rounded-lg p-2 text-xl hover:bg-slate-100 md:hidden"
                aria-label="Open navigation"
              >
                ☰
              </button>
              <div>
                <p className="text-xs text-slate-400">Workspace</p>
                <p className="font-semibold">Dashboard</p>
              </div>
            </div>

            {user ? <Link href="/settings" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">{user.name} · Account</Link> : <Link href="/sign-in" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">{authLoading ? "Loading..." : "Sign In →"}</Link>}
          </header>

          <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
            <div className="animate-fade-in mb-10 mt-3 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 text-3xl text-white shadow-xl shadow-blue-500/20">
                ✳
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
                Meet Nova AI
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                What can I help you with?
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                Ask questions, solve problems, write code, or discover
                something new. Your next idea starts here.
              </p>

              <Link
                href="/chatbot"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <span>✳</span> Start a conversation <span>→</span>
              </Link>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Explore possibilities</h2>
              <span className="text-xs text-slate-400">Quick start</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {prompts.map((item) => (
                <button
                  key={item.title}
                  onClick={() => openPrompt(item.prompt)}
                  className="glass-card rounded-2xl p-5 text-left transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                    {item.icon}
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                  <span className="mt-4 block text-sm font-semibold text-blue-600">
                    Try it →
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold">Recent conversations</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Pick up where you left off
                    </p>
                  </div>
                  <Link
                    href="/chatbot"
                    className="text-sm font-semibold text-blue-600"
                  >
                    Open chat →
                  </Link>
                </div>

                <div className="space-y-2">
                  {conversationsLoading && <p className="px-3 py-4 text-sm text-slate-400">Loading conversations...</p>}
                  {!conversationsLoading && conversations.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">{user ? "Your saved conversations will appear here." : "Sign in to save conversations and see your history."}</p>}
                  {conversations.map((chat) => (
                    <button
                      key={chat._id}
                      onClick={() => router.push(`/chatbot/${chat._id}`)}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg text-violet-600">
                        ✳
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {chat.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(chat.lastMessageAt || chat.updatedAt))}
                        </span>
                      </span>
                      <span className="text-slate-400">→</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-6 text-white shadow-lg shadow-blue-600/10">
                <span className="text-3xl">✨</span>
                <h2 className="mt-5 text-2xl font-bold">
                  Ideas into reality
                </h2>
                <p className="mt-3 text-sm leading-7 text-blue-50">
                  From your first question to your next big project, use your
                  AI assistant to think, create, and learn.
                </p>
                <Link
                  href="/chatbot"
                  className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Start chatting →
                </Link>
                <div className="mt-8 border-t border-white/20 pt-4 text-xs text-blue-100">
                  Your AI workspace · Built for curiosity
                </div>
              </section>
            </div>

            <p className="mt-10 text-center text-xs text-slate-400">
              Nova AI can make mistakes. Verify important information.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
