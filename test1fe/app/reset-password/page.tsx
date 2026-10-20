import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
    return <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading reset form...</main>}><ResetPasswordForm /></Suspense>;
}
