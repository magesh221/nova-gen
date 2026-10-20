import { Suspense } from "react";
import ChatUI from "../component/ChatUI";

async function ConversationContent({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = await params;
    return <ChatUI conversationId={conversationId} />;
}

export default function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
    return <Suspense fallback={<main className="flex h-dvh items-center justify-center bg-[#f8faff] text-sm text-slate-500">Loading conversation...</main>}><ConversationContent params={params} /></Suspense>;
}
