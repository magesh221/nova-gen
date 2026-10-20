"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { authPageUrl, safeReturnTo } from "@/app/services/redirects";

export default function SignUpPage() {
    const router = useRouter();
    const { register, user, loading: authLoading } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [returnTo, setReturnTo] = useState("/chatbot");

    useEffect(() => {
        // Capture the safe internal return URL from the browser query after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReturnTo(safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")));
    }, []);

    useEffect(() => {
        if (!authLoading && user) router.replace("/");
    }, [authLoading, router, user]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            await register({ name, email, password });
            router.replace(returnTo);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to create your account. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || user) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Checking your Nova AI session...</main>;

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
            <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
                <Link href="/" className="text-xl font-bold">Nova <span className="text-blue-600">AI</span></Link>
                <h1 className="mt-8 text-3xl font-bold">Create your account</h1>
                <p className="mt-2 text-sm text-slate-500">Save conversations and continue them any time.</p>
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                    <label className="block text-sm font-semibold" htmlFor="name">Name
                        <input id="name" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    <label className="block text-sm font-semibold" htmlFor="email">Email address
                        <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    <label className="block text-sm font-semibold" htmlFor="password">Password
                        <input id="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                        {loading ? "Creating account..." : "Create account"}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link href={authPageUrl("/sign-in", returnTo)} className="font-semibold text-blue-600">Sign in</Link></p>
            </section>
        </main>
    );
}
