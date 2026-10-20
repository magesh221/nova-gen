import mongoose from 'mongoose';
import Conversation from '../models/conversations.js';
import Message from '../models/messages.js';
import { HttpError } from '../utils/httpError.js';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function objectId(value) {
    if (!mongoose.isValidObjectId(value)) throw new HttpError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    return new mongoose.Types.ObjectId(value);
}

function encodeCursor(document, dateField) {
    return Buffer.from(JSON.stringify({ id: document._id.toString(), date: document[dateField].toISOString() })).toString('base64url');
}

function decodeCursor(cursor) {
    if (!cursor) return null;
    try {
        if (typeof cursor !== 'string' || cursor.length > 300) throw new Error('Invalid cursor');
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        const date = new Date(value.date);
        if (!mongoose.isValidObjectId(value.id) || Number.isNaN(date.getTime())) throw new Error('Invalid cursor');
        return { id: new mongoose.Types.ObjectId(value.id), date };
    } catch {
        throw new HttpError(400, 'The pagination cursor is invalid', 'INVALID_CURSOR');
    }
}

function pageSize(value) {
    const parsed = value === undefined ? DEFAULT_PAGE_SIZE : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
        throw new HttpError(400, `Limit must be between 1 and ${MAX_PAGE_SIZE}`, 'INVALID_LIMIT');
    }
    return parsed;
}

export async function findOwnedConversation(conversationId, userId) {
    const conversation = await Conversation.findById(objectId(conversationId));
    if (!conversation) throw new HttpError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    if (conversation.userId.toString() !== userId.toString()) throw new HttpError(403, 'You do not have access to this conversation', 'FORBIDDEN');
    if (conversation.archived) throw new HttpError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    return conversation;
}

export async function createConversation(userId, { title } = {}) {
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 120)) {
        throw new HttpError(400, 'Title must be 1 to 120 characters', 'INVALID_TITLE');
    }
    return Conversation.create({
        userId,
        title: title?.trim() || 'New chat',
        model: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    });
}

export async function listConversations(userId, { cursor, limit } = {}) {
    const size = pageSize(limit);
    const position = decodeCursor(cursor);
    const query = { userId, archived: false };
    if (position) query.$or = [
        { updatedAt: { $lt: position.date } },
        { updatedAt: position.date, _id: { $lt: position.id } },
    ];

    const documents = await Conversation.find(query)
        .sort({ updatedAt: -1, _id: -1 })
        .limit(size + 1)
        .select('_id title model createdAt updatedAt lastMessageAt');
    const hasMore = documents.length > size;
    const items = documents.slice(0, size);
    return {
        items,
        nextCursor: hasMore ? encodeCursor(items.at(-1), 'updatedAt') : null,
    };
}

export async function getConversation(userId, conversationId) {
    return findOwnedConversation(conversationId, userId);
}

export async function renameConversation(userId, conversationId, title) {
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
        throw new HttpError(400, 'Title must be 1 to 120 characters', 'INVALID_TITLE');
    }
    const conversation = await findOwnedConversation(conversationId, userId);
    conversation.title = title.trim();
    await conversation.save();
    return conversation;
}

export async function deleteConversation(userId, conversationId) {
    const id = objectId(conversationId);
    const existing = await Conversation.findById(id).select('_id userId');
    if (!existing) throw new HttpError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    if (existing.userId.toString() !== userId.toString()) throw new HttpError(403, 'You do not have access to this conversation', 'FORBIDDEN');
    const deleted = await Conversation.findOneAndDelete({ _id: id, userId });
    if (!deleted) throw new HttpError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    await Message.deleteMany({ conversationId: id, userId });
}

export async function listMessages(userId, conversationId, { before, limit } = {}) {
    const conversation = await findOwnedConversation(conversationId, userId);
    const size = pageSize(limit);
    const position = decodeCursor(before);
    const query = { conversationId: conversation._id, userId };
    if (position) query.$or = [
        { createdAt: { $lt: position.date } },
        { createdAt: position.date, _id: { $lt: position.id } },
    ];

    const documents = await Message.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(size + 1)
        .select('_id role content status model usage responseDurationMs createdAt updatedAt');
    const hasMore = documents.length > size;
    const page = documents.slice(0, size);
    return {
        items: page.reverse(),
        nextCursor: hasMore ? encodeCursor(page[0], 'createdAt') : null,
    };
}

export async function searchConversations(userId, queryText, { limit } = {}) {
    if (typeof queryText !== 'string' || queryText.trim().length < 2 || queryText.trim().length > 100) {
        throw new HttpError(400, 'Search must be between 2 and 100 characters', 'INVALID_SEARCH');
    }
    const size = pageSize(limit);
    const search = queryText.trim();
    const [titleMatches, messageMatches] = await Promise.all([
        Conversation.find({ userId, archived: false, $text: { $search: search } })
            .select('_id title model createdAt updatedAt lastMessageAt')
            .limit(size),
        Message.find({ userId, $text: { $search: search } })
            .select('conversationId')
            .limit(size * 3),
    ]);
    const ids = new Set([...titleMatches.map((item) => item._id.toString()), ...messageMatches.map((item) => item.conversationId.toString())]);
    if (ids.size === 0) return [];
    return Conversation.find({ userId, archived: false, _id: { $in: [...ids] } })
        .sort({ updatedAt: -1, _id: -1 })
        .limit(size)
        .select('_id title model createdAt updatedAt lastMessageAt');
}
