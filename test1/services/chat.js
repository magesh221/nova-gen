import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Conversation from '../models/conversations.js';
import Message from '../models/messages.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { generateChatCompletion } from './aiProvider.js';
import { findOwnedConversation } from './conversations.js';
import { HttpError } from '../utils/httpError.js';

const activeGenerations = new Map();
const MAX_CONTEXT_CHARACTERS = 24_000;

function getLocalTitle(content) {
    const title = content.replace(/\s+/g, ' ').trim();
    return title.length > 64 ? `${title.slice(0, 61).trimEnd()}...` : title;
}

export function validateMessage({ content, clientMessageId }) {
    if (typeof content !== 'string' || !content.trim() || content.trim().length > 12_000) {
        throw new HttpError(400, 'Message must be between 1 and 12,000 characters', 'INVALID_MESSAGE');
    }
    if (typeof clientMessageId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(clientMessageId)) {
        throw new HttpError(400, 'A valid clientMessageId is required', 'INVALID_CLIENT_MESSAGE_ID');
    }
    return content.trim();
}

async function ensureNoActiveGeneration(conversationId, userId) {
    const active = await Message.exists({ conversationId, userId, role: 'assistant', status: 'pending' });
    if (active) throw new HttpError(409, 'A response is already being generated for this conversation', 'GENERATION_IN_PROGRESS');
}

export async function prepareUserMessage(userId, conversationId, input) {
    const content = validateMessage(input);
    const conversation = await findOwnedConversation(conversationId, userId);
    const prior = await Message.findOne({ conversationId: conversation._id, userId, role: 'user', clientMessageId: input.clientMessageId });
    if (prior) {
        if (prior.content !== content) throw new HttpError(409, 'This clientMessageId was already used for different content', 'IDEMPOTENCY_KEY_REUSED');
        const assistant = await Message.findOne({ conversationId: conversation._id, userId, role: 'assistant', replyToMessageId: prior._id }).sort({ attempt: -1 });
        if (assistant?.status === 'completed') return { duplicate: true, conversation, userMessage: prior, assistantMessage: assistant };
        if (assistant?.status === 'pending') throw new HttpError(409, 'This message is already being processed', 'GENERATION_IN_PROGRESS');
        if (assistant?.status === 'failed') throw new HttpError(409, 'This response failed. Retry the response to continue.', 'GENERATION_FAILED');
        await ensureNoActiveGeneration(conversation._id, userId);
        return { duplicate: true, conversation, userMessage: prior, assistantMessage: null };
    }

    await ensureNoActiveGeneration(conversation._id, userId);
    let userMessage;
    try {
        userMessage = await Message.create({
            conversationId: conversation._id,
            userId,
            role: 'user',
            content,
            status: 'completed',
            clientMessageId: input.clientMessageId,
        });
    } catch (error) {
        if (error?.code === 11000) throw new HttpError(409, 'This message was already submitted', 'DUPLICATE_MESSAGE');
        throw error;
    }

    const update = { lastMessageAt: userMessage.createdAt, updatedAt: userMessage.createdAt };
    if (!conversation.lastMessageAt) update.title = getLocalTitle(content);
    await Conversation.updateOne({ _id: conversation._id, userId }, { $set: update });
    logger.info('User message saved', { userId, conversationId: conversation._id.toString(), messageId: userMessage._id.toString() });
    return { duplicate: false, conversation, userMessage, assistantMessage: null };
}

export async function createAssistantAttempt(userId, conversation, userMessage, attempt = 0) {
    const generationId = crypto.randomUUID();
    try {
        return await Message.create({
            conversationId: conversation._id,
            userId,
            role: 'assistant',
            content: '',
            status: 'pending',
            model: conversation.model,
            generationId,
            replyToMessageId: userMessage._id,
            attempt,
        });
    } catch (error) {
        if (error?.code === 11000) throw new HttpError(409, 'A response is already being generated for this conversation', 'GENERATION_IN_PROGRESS');
        throw error;
    }
}

async function buildContext(userId, conversationId, throughMessage) {
    const docs = await Message.find({
        userId,
        conversationId,
        status: 'completed',
        role: { $in: ['user', 'assistant'] },
        $or: [
            { createdAt: { $lt: throughMessage.createdAt } },
            { createdAt: throughMessage.createdAt, _id: { $lte: throughMessage._id } },
        ],
    }).sort({ createdAt: -1, _id: -1 }).limit(env.aiContextMessages).select('role content');

    const context = docs.reverse().map(({ role, content }) => ({ role, content }));
    while (context.length > 1 && context.reduce((total, item) => total + item.content.length, 0) > MAX_CONTEXT_CHARACTERS) {
        context.shift();
    }
    return context;
}

export async function runGeneration({ userId, conversation, userMessage, assistantMessage, onDelta = () => {}, signal }) {
    const assistantId = assistantMessage._id.toString();
    const controller = new AbortController();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', () => controller.abort(), { once: true });
    activeGenerations.set(assistantId, { controller, userId: String(userId), conversationId: conversation._id.toString() });

    const startedAt = Date.now();
    let partialContent = '';
    try {
        const messages = await buildContext(userId, conversation._id, userMessage);
        const result = await generateChatCompletion({
            messages,
            model: conversation.model,
            signal: controller.signal,
            onDelta(chunk) {
                partialContent += chunk;
                onDelta(chunk);
            },
        });

        const responseDurationMs = Date.now() - startedAt;
        const completed = await Message.findOneAndUpdate({ _id: assistantMessage._id, userId, status: 'pending' }, {
            $set: {
                content: result.content,
                status: 'completed',
                usage: result.usage,
                responseDurationMs,
            },
        }, { new: true });
        await Conversation.updateOne({ _id: conversation._id, userId }, {
            $set: { lastMessageAt: assistantMessage.createdAt },
            $currentDate: { updatedAt: true },
        });
        if (!completed) throw new HttpError(409, 'The response could not be saved', 'MESSAGE_STATE_CONFLICT');
        await Conversation.updateOne({ _id: conversation._id, userId }, { $set: { lastMessageAt: completed.createdAt }, $currentDate: { updatedAt: true } });
        logger.info('AI response completed', {
            userId,
            conversationId: conversation._id.toString(),
            messageId: completed._id.toString(),
            model: conversation.model,
            responseDurationMs,
            totalTokens: result.usage?.totalTokens,
        });
        return completed;
    } catch (error) {
        const failed = await Message.findOneAndUpdate({ _id: assistantMessage._id, userId, status: 'pending' }, {
            $set: {
                content: partialContent,
                status: 'failed',
                errorCode: error.code || 'AI_PROVIDER_ERROR',
                responseDurationMs: Date.now() - startedAt,
            },
        }, { new: true });
        logger.warn('AI response failed', {
            userId,
            conversationId: conversation._id.toString(),
            messageId: assistantMessage._id.toString(),
            errorCode: error.code || 'AI_PROVIDER_ERROR',
        });
        throw Object.assign(error, { savedAssistantMessage: failed });
    } finally {
        activeGenerations.delete(assistantId);
    }
}

export async function regenerateResponse(userId, conversationId, messageId) {
    const conversation = await findOwnedConversation(conversationId, userId);
    if (!mongoose.isValidObjectId(messageId)) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    const previous = await Message.findOne({ _id: messageId, conversationId: conversation._id, userId, role: 'assistant' });
    if (!previous || !previous.replyToMessageId) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    if (previous.status === 'pending') throw new HttpError(409, 'This response is still being generated', 'GENERATION_IN_PROGRESS');
    await ensureNoActiveGeneration(conversation._id, userId);

    const userMessage = await Message.findOne({ _id: previous.replyToMessageId, conversationId: conversation._id, userId, role: 'user' });
    if (!userMessage) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    const latestAttempt = await Message.findOne({ conversationId: conversation._id, replyToMessageId: userMessage._id, role: 'assistant' }).sort({ attempt: -1 }).select('attempt');
    const assistantMessage = await createAssistantAttempt(userId, conversation, userMessage, (latestAttempt?.attempt ?? -1) + 1);
    return { conversation, userMessage, assistantMessage };
}

export async function stopGeneration(userId, conversationId, messageId) {
    if (!mongoose.isValidObjectId(messageId)) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    const conversation = await findOwnedConversation(conversationId, userId);
    const assistant = await Message.findOne({ _id: messageId, conversationId: conversation._id, userId, role: 'assistant', status: 'pending' });
    if (!assistant) throw new HttpError(404, 'Active generation not found', 'GENERATION_NOT_FOUND');
    const active = activeGenerations.get(assistant._id.toString());
    if (!active || active.userId !== String(userId)) throw new HttpError(409, 'Generation cannot be stopped from this server process', 'GENERATION_NOT_ACTIVE');
    active.controller.abort();
}

export async function getOwnedMessage(userId, conversationId, messageId) {
    if (!mongoose.isValidObjectId(messageId)) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    const conversation = await findOwnedConversation(conversationId, userId);
    const message = await Message.findOne({ _id: messageId, conversationId: conversation._id, userId });
    if (!message) throw new HttpError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
    return message;
}
