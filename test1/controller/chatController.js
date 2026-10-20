import { logger } from '../config/logger.js';
import {
    createAssistantAttempt,
    prepareUserMessage,
    regenerateResponse,
    runGeneration,
    stopGeneration,
} from '../services/chat.js';
import { findOwnedConversation } from '../services/conversations.js';

function publicMessage(message) {
    return {
        _id: message._id,
        role: message.role,
        content: message.content,
        status: message.status,
        model: message.model,
        usage: message.usage,
        responseDurationMs: message.responseDurationMs,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        attempt: message.attempt,
    };
}

function writeEvent(res, event, data) {
    if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function deliverResponse({ req, res, next, userId, conversation, userMessage, assistantMessage }) {
    const wantsStream = req.get('accept')?.includes('text/event-stream') || req.body?.stream === true;
    if (!wantsStream) {
        try {
            const assistant = await runGeneration({ userId, conversation, userMessage, assistantMessage });
            return res.status(201).json({ success: true, data: { userMessage: publicMessage(userMessage), assistantMessage: publicMessage(assistant) } });
        } catch (error) {
            return next(error);
        }
    }

    res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    writeEvent(res, 'start', {
        userMessage: publicMessage(userMessage),
        assistantMessage: publicMessage(assistantMessage),
    });

    const abortController = new AbortController();
    const abortOnDisconnect = () => {
        if (!res.writableEnded) abortController.abort();
    };
    res.on('close', abortOnDisconnect);

    try {
        const assistant = await runGeneration({
            userId,
            conversation,
            userMessage,
            assistantMessage,
            signal: abortController.signal,
            onDelta: (content) => writeEvent(res, 'delta', { content }),
        });
        writeEvent(res, 'done', { assistantMessage: publicMessage(assistant) });
    } catch (error) {
        writeEvent(res, 'error', {
            message: error.message || 'Unable to generate a response.',
            code: error.code || 'AI_PROVIDER_ERROR',
            assistantMessage: error.savedAssistantMessage ? publicMessage(error.savedAssistantMessage) : undefined,
        });
    } finally {
        res.off('close', abortOnDisconnect);
        if (!res.writableEnded) res.end();
        logger.debug('Message stream closed', { requestId: req.requestId, conversationId: conversation._id.toString() });
    }
}

export async function sendMessage(req, res, next) {
    try {
        const prepared = await prepareUserMessage(req.auth.userId, req.params.id, req.body || {});
        if (prepared.duplicate && prepared.assistantMessage) {
            return res.json({ success: true, data: {
                userMessage: publicMessage(prepared.userMessage),
                assistantMessage: publicMessage(prepared.assistantMessage),
                duplicate: true,
            } });
        }
        const conversation = prepared.conversation || await findOwnedConversation(req.params.id, req.auth.userId);
        const assistantMessage = prepared.assistantMessage || await createAssistantAttempt(
            req.auth.userId,
            conversation,
            prepared.userMessage,
            0,
        );
        logger.info('AI generation started', {
            userId: req.auth.userId,
            conversationId: conversation._id.toString(),
            userMessageId: prepared.userMessage._id.toString(),
            assistantMessageId: assistantMessage._id.toString(),
        });
        return await deliverResponse({
            req,
            res,
            next,
            userId: req.auth.userId,
            conversation,
            userMessage: prepared.userMessage,
            assistantMessage,
        });
    } catch (error) {
        next(error);
    }
}

export async function regenerate(req, res, next) {
    try {
        const { conversation, userMessage, assistantMessage } = await regenerateResponse(
            req.auth.userId,
            req.params.id,
            req.params.messageId,
        );
        return await deliverResponse({
            req,
            res,
            next,
            userId: req.auth.userId,
            conversation,
            userMessage,
            assistantMessage,
        });
    } catch (error) {
        next(error);
    }
}

export async function stop(req, res, next) {
    try {
        await stopGeneration(req.auth.userId, req.params.id, req.params.messageId);
        res.status(202).json({ success: true, data: { stopped: true } });
    } catch (error) {
        next(error);
    }
}
