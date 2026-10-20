"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/services/api";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);
        try {
            const result = await requestPasswordReset(email);
            setMessage(result.message);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to request a reset link.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
            <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
                <Link href="/" className="text-xl font-bold">Nova <span className="text-blue-600">AI</span></Link>
                <h1 className="mt-8 text-3xl font-bold">Reset your password</h1>
                <p className="mt-2 text-sm text-slate-500">Enter the email address connected to your account.</p>
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                    <label htmlFor="email" className="block text-sm font-semibold">Email address
                        <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                        {loading ? "Sending..." : "Email reset link"}
                    </button>
                </form>
                <Link href="/sign-in" className="mt-6 inline-block text-sm font-semibold text-blue-600">Back to sign in</Link>
            </section>
        </main>
    );
}
