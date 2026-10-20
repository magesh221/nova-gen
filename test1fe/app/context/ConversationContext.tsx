"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    deleteConversation as apiDeleteConversation,
    listConversations,
    renameConversation as apiRenameConversation,
    searchConversations as apiSearchConversations,
    type Conversation,
} from "@/app/services/api";
import { useAuth } from "./AuthContext";

type ConversationContextValue = {
    conversations: Conversation[];
    loading: boolean;
    error: string;
    nextCursor: string | null;
    reload: () => Promise<void>;
    loadMore: () => Promise<void>;
    search: (query: string) => Promise<Conversation[]>;
    rename: (id: string, title: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
};

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const reload = useCallback(async () => {
        if (!user) {
            setConversations([]);
            setNextCursor(null);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const page = await listConversations();
            setConversations(page.items);
            setNextCursor(page.nextCursor);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to load conversations.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        // The request updates context state after its network response resolves.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void reload();
    }, [authLoading, reload]);

    const loadMore = useCallback(async () => {
        if (!user || !nextCursor || loading) return;
        setLoading(true);
        try {
            const page = await listConversations(nextCursor);
            setConversations((current) => [...current, ...page.items]);
            setNextCursor(page.nextCursor);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "Unable to load more conversations.");
        } finally {
            setLoading(false);
        }
    }, [loading, nextCursor, user]);

    const search = useCallback(async (query: string) => {
        if (!user || query.trim().length < 2) return [];
        return apiSearchConversations(query.trim());
    }, [user]);

    const rename = useCallback(async (id: string, title: string) => {
        const updated = await apiRenameConversation(id, title);
        setConversations((current) => current.map((item) => item._id === id ? updated : item).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    }, []);

    const remove = useCallback(async (id: string) => {
        await apiDeleteConversation(id);
        setConversations((current) => current.filter((item) => item._id !== id));
    }, []);

    const value = useMemo(() => ({ conversations: user ? conversations : [], loading, error, nextCursor, reload, loadMore, search, rename, remove }), [
        user, conversations, loading, error, nextCursor, reload, loadMore, search, rename, remove,
    ]);

    return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversations() {
    const value = useContext(ConversationContext);
    if (!value) throw new Error("useConversations must be used inside ConversationProvider");
    return value;
}
