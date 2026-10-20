import { logger } from '../config/logger.js';
import {
    createConversation,
    deleteConversation,
    getConversation,
    listConversations,
    listMessages,
    renameConversation,
    searchConversations,
} from '../services/conversations.js';

export async function create(req, res, next) {
    try {
        const conversation = await createConversation(req.auth.userId, req.body || {});
        logger.info('Conversation created', { userId: req.auth.userId, conversationId: conversation._id.toString() });
        res.status(201).json({ success: true, data: { conversation } });
    } catch (error) {
        next(error);
    }
}

export async function list(req, res, next) {
    try {
        const result = await listConversations(req.auth.userId, { cursor: req.query.cursor, limit: req.query.limit });
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function get(req, res, next) {
    try {
        const conversation = await getConversation(req.auth.userId, req.params.id);
        res.json({ success: true, data: { conversation } });
    } catch (error) {
        next(error);
    }
}

export async function messages(req, res, next) {
    try {
        const result = await listMessages(req.auth.userId, req.params.id, {
            before: req.query.before,
            limit: req.query.limit,
        });
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function rename(req, res, next) {
    try {
        const conversation = await renameConversation(req.auth.userId, req.params.id, req.body?.title);
        logger.info('Conversation renamed', { userId: req.auth.userId, conversationId: conversation._id.toString() });
        res.json({ success: true, data: { conversation } });
    } catch (error) {
        next(error);
    }
}

export async function remove(req, res, next) {
    try {
        await deleteConversation(req.auth.userId, req.params.id);
        logger.info('Conversation deleted', { userId: req.auth.userId, conversationId: req.params.id });
        res.json({ success: true, data: { deleted: true } });
    } catch (error) {
        next(error);
    }
}

export async function search(req, res, next) {
    try {
        const conversations = await searchConversations(req.auth.userId, req.query.q, { limit: req.query.limit });
        res.json({ success: true, data: { conversations } });
    } catch (error) {
        next(error);
    }
}
