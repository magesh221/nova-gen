export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export type User = {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
};

export type Conversation = {
    _id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string | null;
};

export type StoredMessage = ChatMessage & {
    _id: string;
    status: "pending" | "completed" | "failed";
    model: string | null;
    createdAt: string;
    updatedAt: string;
    attempt?: number;
};

export class ApiError extends Error {
    code?: string;
    assistantMessage?: StoredMessage;

    constructor(message: string, code?: string, assistantMessage?: StoredMessage) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.assistantMessage = assistantMessage;
    }
}

type ApiEnvelope<T> = {
    success: boolean;
    data: T;
    message?: string;
};

type ApiErrorBody = {
    message?: string;
    code?: string;
};

function getApiBaseUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!configuredUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    const baseUrl = configuredUrl.replace(/\/+$/, "");
    return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}

function getEndpoint(path: string, versioned: boolean) {
    const version = versioned ? "/v1" : "";
    return `${getApiBaseUrl()}${version}/${path.replace(/^\/+/, "")}`;
}

async function fetchEndpoint(path: string, init: RequestInit, versioned: boolean) {
    try {
        return await fetch(getEndpoint(path, versioned), { ...init, credentials: "include" });
    } catch {
        if (init.signal?.aborted) throw new DOMException("Request was cancelled", "AbortError");
        throw new Error("Could not connect to the API. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.");
    }
}

async function fetchAuthenticatedEndpoint(path: string, init: RequestInit, versioned = true, retryAuth = true) {
    let response = await fetchEndpoint(path, init, versioned);
    const isPublicAuthRequest = ["auth/login", "auth/register", "auth/forgot-password", "auth/reset-password", "auth/logout", "auth/refresh"].includes(path);
    if (response.status === 401 && retryAuth && !isPublicAuthRequest) {
        const refreshed = await fetchEndpoint("auth/refresh", { method: "POST" }, true);
        if (refreshed.ok) response = await fetchEndpoint(path, init, versioned);
    }
    if (response.status === 401 && !isPublicAuthRequest && typeof window !== "undefined") {
        window.dispatchEvent(new Event("nova:session-expired"));
    }
    return response;
}

async function request<T>(path: string, init: RequestInit = {}, options: { versioned?: boolean; retryAuth?: boolean } = {}): Promise<T> {
    const versioned = options.versioned ?? true;
    const response = await fetchAuthenticatedEndpoint(path, init, versioned, options.retryAuth !== false);

    const body = await response.json().catch(() => ({})) as ApiEnvelope<T> & ApiErrorBody;
    if (!response.ok) throw new ApiError(body.message || "The request failed. Please try again.", body.code);
    return body.data as T;
}

export async function signIn(credentials: { email: string; password: string }) {
    const result = await request<{ user: User }>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
    }, { retryAuth: false });
    return result.user;
}

export async function registerAccount(details: { name: string; email: string; password: string }) {
    const result = await request<{ user: User }>("auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
    }, { retryAuth: false });
    return result.user;
}

export async function signOut() {
    await request<{ signedOut: boolean }>("auth/logout", { method: "POST" }, { retryAuth: false });
}

export async function getCurrentUser() {
    const result = await request<{ user: User }>("auth/me");
    return result.user;
}

export async function requestPasswordReset(email: string) {
    return request<{ message: string }>("auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    }, { retryAuth: false });
}

export async function resetPassword(token: string, password: string) {
    return request<{ message: string }>("auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
    }, { retryAuth: false });
}

export async function createConversation(title?: string) {
    const result = await request<{ conversation: Conversation }>("conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(title ? { title } : {}),
    });
    return result.conversation;
}

export async function listConversations(cursor?: string, limit = 30) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    return request<{ items: Conversation[]; nextCursor: string | null }>(`conversations?${query}`);
}

export async function getConversation(conversationId: string) {
    const result = await request<{ conversation: Conversation }>(`conversations/${encodeURIComponent(conversationId)}`);
    return result.conversation;
}

export async function getConversationMessages(conversationId: string, before?: string, limit = 50) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set("before", before);
    return request<{ items: StoredMessage[]; nextCursor: string | null }>(
        `conversations/${encodeURIComponent(conversationId)}/messages?${query}`,
    );
}

export async function renameConversation(conversationId: string, title: string) {
    const result = await request<{ conversation: Conversation }>(`conversations/${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    return result.conversation;
}

export async function deleteConversation(conversationId: string) {
    return request<{ deleted: boolean }>(`conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
}

export async function searchConversations(queryText: string, limit = 30) {
    const query = new URLSearchParams({ q: queryText, limit: String(limit) });
    const result = await request<{ conversations: Conversation[] }>(`conversations/search?${query}`);
    return result.conversations;
}

async function readEventStream(response: Response, onDelta: (content: string) => void, onStart?: (assistantId: string) => void) {
    if (!response.body) throw new Error("The server did not open a response stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantMessage: StoredMessage | undefined;

    const processEvent = (rawEvent: string) => {
        const lines = rawEvent.split(/\r?\n/);
        const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!event || !data) return;
        const payload = JSON.parse(data) as {
            content?: string;
            assistantMessage?: StoredMessage;
            message?: string;
            code?: string;
        };

        if (event === "start" && payload.assistantMessage) onStart?.(payload.assistantMessage._id);
        if (event === "delta" && payload.content) onDelta(payload.content);
        if (event === "done" && payload.assistantMessage) assistantMessage = payload.assistantMessage;
        if (event === "error") throw new ApiError(payload.message || "The response could not be generated.", payload.code, payload.assistantMessage);
    };

    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let separator = buffer.search(/\r?\n\r?\n/);
        while (separator >= 0) {
            const delimiter = buffer.slice(separator).match(/^\r?\n\r?\n/)?.[0] || "\n\n";
            processEvent(buffer.slice(0, separator));
            buffer = buffer.slice(separator + delimiter.length);
            separator = buffer.search(/\r?\n\r?\n/);
        }
        if (done) break;
    }

    if (!assistantMessage) throw new Error("The response stream ended before the assistant reply was saved.");
    return assistantMessage;
}

export async function sendConversationMessage(
    conversationId: string,
    input: { content: string; clientMessageId: string },
    options: { onDelta?: (content: string) => void; onStart?: (assistantId: string) => void; signal?: AbortSignal } = {},
) {
    const response = await fetchAuthenticatedEndpoint(`conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
        signal: options.signal,
    }, true);

    if (!response.ok) {
        const body = await response.json().catch(() => ({})) as ApiErrorBody;
        throw new ApiError(body.message || "Unable to send the message.", body.code);
    }

    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
        const body = await response.json() as ApiEnvelope<{ userMessage: StoredMessage; assistantMessage: StoredMessage }>;
        return body.data;
    }

    const assistantMessage = await readEventStream(response, options.onDelta || (() => {}), options.onStart);
    return { assistantMessage };
}

export async function regenerateMessage(
    conversationId: string,
    messageId: string,
    options: { onDelta?: (content: string) => void; onStart?: (assistantId: string) => void; signal?: AbortSignal } = {},
) {
    const response = await fetchAuthenticatedEndpoint(`conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/regenerate`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        signal: options.signal,
    }, true);
    if (!response.ok) {
        const body = await response.json().catch(() => ({})) as ApiErrorBody;
        throw new ApiError(body.message || "Unable to regenerate the response.", body.code);
    }
    const assistantMessage = await readEventStream(response, options.onDelta || (() => {}), options.onStart);
    return assistantMessage;
}

export async function stopGeneration(conversationId: string, messageId: string) {
    return request<{ stopped: boolean }>(`conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/stop`, { method: "POST" });
}

