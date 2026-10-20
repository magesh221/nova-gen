"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, registerAccount, signIn as apiSignIn, signOut as apiSignOut, type User } from "@/app/services/api";

type AuthContextValue = {
    user: User | null;
    loading: boolean;
    signIn: (credentials: { email: string; password: string }) => Promise<User>;
    register: (details: { name: string; email: string; password: string }) => Promise<User>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            return currentUser;
        } catch {
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        void getCurrentUser().then((currentUser) => {
            if (active) setUser(currentUser);
        }).catch(() => {
            if (active) setUser(null);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        const handleSessionExpired = () => setUser(null);
        window.addEventListener("nova:session-expired", handleSessionExpired);
        return () => window.removeEventListener("nova:session-expired", handleSessionExpired);
    }, []);

    const signIn = useCallback(async (credentials: { email: string; password: string }) => {
        const authenticatedUser = await apiSignIn(credentials);
        setUser(authenticatedUser);
        return authenticatedUser;
    }, []);

    const register = useCallback(async (details: { name: string; email: string; password: string }) => {
        const authenticatedUser = await registerAccount(details);
        setUser(authenticatedUser);
        return authenticatedUser;
    }, []);

    const signOut = useCallback(async () => {
        try {
            await apiSignOut();
        } finally {
            setUser(null);
        }
    }, []);

    return <AuthContext.Provider value={{ user, loading, signIn, register, signOut, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error("useAuth must be used inside AuthProvider");
    return value;
}
