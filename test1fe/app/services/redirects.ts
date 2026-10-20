const APP_ORIGIN = "https://nova-ai.invalid";
const DEFAULT_AUTH_REDIRECT = "/chatbot";

export function safeReturnTo(candidate: string | null | undefined): string {
    if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) {
        return DEFAULT_AUTH_REDIRECT;
    }

    try {
        const target = new URL(candidate, APP_ORIGIN);
        if (target.origin !== APP_ORIGIN || target.pathname === "/sign-in" || target.pathname === "/sign-up") {
            return DEFAULT_AUTH_REDIRECT;
        }
        return `${target.pathname}${target.search}${target.hash}`;
    } catch {
        return DEFAULT_AUTH_REDIRECT;
    }
}

export function signInRequiredUrl(path: string): string {
    const returnTo = safeReturnTo(path);
    return `/sign-in?notice=chat_required&returnTo=${encodeURIComponent(returnTo)}`;
}

export function authPageUrl(page: "/sign-in" | "/sign-up", returnTo: string): string {
    return `${page}?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
