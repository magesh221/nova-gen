import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/httpError.js';

function textFromContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('');
    return '';
}

function contentFromEvent(event) {
    if (event === '[DONE]') return { done: true };
    let value;
    try { value = JSON.parse(event); } catch { return {}; }
    const choice = value.choices?.[0];
    return {
        content: textFromContent(choice?.delta?.content ?? choice?.message?.content),
        usage: value.usage,
        done: false,
    };
}

function normalizeUsage(usage) {
    if (!usage || typeof usage !== 'object') return undefined;
    const promptTokens = Number(usage.prompt_tokens) || 0;
    const completionTokens = Number(usage.completion_tokens) || 0;
    return { promptTokens, completionTokens, totalTokens: Number(usage.total_tokens) || promptTokens + completionTokens };
}

export async function generateChatCompletion({ messages, model = env.aiModel, signal, onDelta = () => {} }) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, env.aiTimeoutMs);
    const abortFromParent = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abortFromParent, { once: true });

    try {
        const response = await fetch(env.aiBaseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.aiApiKey}` },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                max_tokens: env.aiMaxOutputTokens,
                messages,
                stream: true,
                stream_options: { include_usage: true },
            }),
        });

        if (!response.ok) {
            logger.warn('AI provider returned an error', { statusCode: response.status, model });
            throw new HttpError(502, 'The AI service could not complete this request. Please try again.', 'AI_PROVIDER_ERROR');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            const body = await response.json().catch(() => ({}));
            const content = textFromContent(body.choices?.[0]?.message?.content);
            if (!content.trim()) throw new HttpError(502, 'The AI service returned an empty response.', 'AI_EMPTY_RESPONSE');
            onDelta(content);
            return { content, usage: normalizeUsage(body.usage) };
        }

        if (!response.body) throw new HttpError(502, 'The AI service returned no response stream.', 'AI_EMPTY_RESPONSE');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        let usage;
        let finished = false;

        const processEvent = (event) => {
            const dataLines = event.split(/\r?\n/).filter((line) => line.startsWith('data:'));
            if (dataLines.length === 0) return;
            const parsed = contentFromEvent(dataLines.map((line) => line.slice(5).trimStart()).join('\n'));
            if (parsed.content) {
                content += parsed.content;
                onDelta(parsed.content);
            }
            if (parsed.usage) usage = normalizeUsage(parsed.usage);
            if (parsed.done) finished = true;
        };

        while (!finished) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            let separator = buffer.search(/\r?\n\r?\n/);
            while (separator >= 0) {
                const match = buffer.slice(separator).match(/^\r?\n\r?\n/);
                const delimiterLength = match?.[0].length || 2;
                processEvent(buffer.slice(0, separator));
                buffer = buffer.slice(separator + delimiterLength);
                if (finished) break;
                separator = buffer.search(/\r?\n\r?\n/);
            }
            if (done) {
                if (buffer.trim()) processEvent(buffer);
                break;
            }
        }
        await reader.cancel().catch(() => {});
        if (!content.trim()) throw new HttpError(502, 'The AI service returned an empty response.', 'AI_EMPTY_RESPONSE');
        return { content, usage };
    } catch (error) {
        if (controller.signal.aborted) {
            if (timedOut) throw new HttpError(504, 'The AI service took too long to respond. Please try again.', 'AI_TIMEOUT');
            throw new HttpError(499, 'Generation stopped.', 'GENERATION_STOPPED');
        }
        if (error instanceof HttpError) throw error;
        logger.warn('AI provider request failed', { model, error: error.message });
        throw new HttpError(502, 'Unable to connect to the AI service. Please try again.', 'AI_PROVIDER_ERROR');
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromParent);
    }
}
