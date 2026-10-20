"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { authPageUrl } from "../services/redirects";

export default function SettingsPage() {
    const router = useRouter();
    const { user, loading, signOut } = useAuth();
    const [error, setError] = useState("");

    useEffect(() => {
        if (!loading && !user) router.replace(authPageUrl("/sign-in", `${window.location.pathname}${window.location.search}`));
    }, [loading, router, user]);

    async function handleSignOut() {
        setError("");
        try {
            await signOut();
            router.replace("/");
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to sign out. Please try again.");
        }
    }

    return (
        <main className="min-h-screen bg-[#f8faff] px-4 py-10">
            <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <Link href="/chatbot" className="text-sm font-semibold text-blue-600 hover:underline">← Back to chat</Link>
                <h1 className="mt-6 text-2xl font-bold">Account settings</h1>
                {loading ? <p className="mt-5 text-sm text-slate-500">Loading account...</p> : user && <>
                    <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
                        <div className="p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</dt><dd className="mt-1 text-sm">{user.name}</dd></div>
                        <div className="p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 text-sm">{user.email}</dd></div>
                        <div className="p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Member since</dt><dd className="mt-1 text-sm">{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(user.createdAt))}</dd></div>
                    </dl>
                    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button onClick={() => void handleSignOut()} className="mt-6 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Sign out</button>
                </>}
            </section>
        </main>
    );
}
