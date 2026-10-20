"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/app/services/api";

export default function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!token) return setError("This password reset link is invalid or expired.");
        if (password !== confirmPassword) return setError("The passwords do not match.");

        setLoading(true);
        try {
            await resetPassword(token, password);
            router.replace("/sign-in?passwordReset=1");
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to reset your password.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
            <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
                <Link href="/" className="text-xl font-bold">Nova <span className="text-blue-600">AI</span></Link>
                <h1 className="mt-8 text-3xl font-bold">Choose a new password</h1>
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                    <label htmlFor="password" className="block text-sm font-semibold">New password
                        <input id="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold">Confirm password
                        <input id="confirmPassword" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500" />
                    </label>
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                        {loading ? "Updating..." : "Reset password"}
                    </button>
                </form>
            </section>
        </main>
    );
}
