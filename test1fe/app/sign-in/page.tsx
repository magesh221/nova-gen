
"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { authPageUrl, safeReturnTo } from "@/app/services/redirects";
const SignInPage = () => {

    const router = useRouter();
    const { signIn, user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [returnTo, setReturnTo] = useState("/chatbot");

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        // Capture the safe internal return URL from the browser query after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReturnTo(safeReturnTo(query.get("returnTo")));
        if (query.get("notice") === "chat_required") setNotice("Please sign in to start chatting with Nova AI.");
    }, []);

    useEffect(() => {
        if (!authLoading && user) router.replace("/");
    }, [authLoading, router, user]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signIn({ email, password });
            router.replace(returnTo);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || user) return <main className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">Checking your Nova AI session...</main>;

    return (
        <main className="flex min-h-screen bg-white">
            <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                <div className="w-full max-w-md">
                    <Link href="/" className="mb-12 inline-flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">
                            ✳
                        </span>
                        <span className="text-2xl font-bold">
                            Nova<span className="text-blue-600"> AI</span>
                        </span>
                    </Link>

                    <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Sign in to continue your conversations with Nova AI.
                    </p>
                    {notice && <p role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-semibold"
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-semibold"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                            />
                        </div>

                        {error && (
                            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? "Signing in..." : "Sign In →"}
                        </button>
                    </form>

                    <div className="mt-5 flex justify-between text-sm">
                        <Link href="/forgot-password" className="font-semibold text-blue-600 hover:underline">
                            Forgot password?
                        </Link>
                        <Link href={authPageUrl("/sign-up", returnTo)} className="font-semibold text-blue-600 hover:underline">
                            Create an account
                        </Link>
                    </div>

                    <p className="mt-7 text-center text-sm text-slate-500">
                        Just exploring?{" "}
                        <Link href="/" className="font-semibold text-blue-600 hover:underline">
                            Browse the home page
                        </Link>
                    </p>

                    <p className="mt-10 text-center text-xs text-slate-400">
                        By continuing, you agree to use the service responsibly.
                    </p>
                </div>
            </section>

            <aside className="relative hidden flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-12 lg:flex">
                <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />

                <div className="relative max-w-lg text-white">
                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-5xl backdrop-blur">
                        ✳
                    </div>
                    <h2 className="text-5xl font-bold leading-tight">
                        A little curiosity can take you a long way.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-blue-100">
                        Brainstorm ideas, solve problems, learn new skills, and turn
                        your thoughts into something great with your AI companion.
                    </p>

                    <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                        <p className="text-sm leading-7 text-blue-50">
                            “The best way to learn is to stay curious and keep asking
                            questions.”
                        </p>
                        <p className="mt-3 text-xs text-blue-200">Your Nova AI workspace</p>
                    </div>
                </div>
            </aside>
        </main>
    );
}


export default SignInPage
