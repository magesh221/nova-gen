"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ConversationProvider } from "./context/ConversationContext";

export default function Providers({ children }: { children: ReactNode }) {
    return <AuthProvider><ConversationProvider>{children}</ConversationProvider></AuthProvider>;
}
