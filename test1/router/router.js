import express from 'express';
import {
    forgotPassword,
    login,
    logout,
    me,
    refresh,
    register,
    requireAuth,
    resetPasswordHandler,
} from '../controller/authController.js';
import * as conversations from '../controller/conversationController.js';
import * as chat from '../controller/chatController.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/authenticate.js';
import { dailyQuota } from '../middleware/dailyQuota.js';

const router = express.Router();
const authLimit = rateLimit({ name: 'auth', limit: 10, windowMs: 15 * 60 * 1000 });
const resetLimit = rateLimit({ name: 'password-reset', limit: 5, windowMs: 60 * 60 * 1000 });
const refreshLimit = rateLimit({ name: 'auth-refresh', limit: 30, windowMs: 60 * 1000 });
const conversationLimit = rateLimit({ name: 'conversations', limit: 90, windowMs: 60 * 1000 });
const generationLimit = rateLimit({ name: 'ai-generation', limit: 20, windowMs: 60 * 1000 });

router.post('/auth/register', authLimit, register);
router.post('/auth/login', authLimit, login);
router.post('/auth/logout', logout);
router.post('/auth/refresh', refreshLimit, refresh);
router.get('/auth/me', requireAuth, me);
router.post('/auth/forgot-password', resetLimit, forgotPassword);
router.post('/auth/reset-password', resetLimit, resetPasswordHandler);

router.post('/conversations', authenticate, conversationLimit, conversations.create);
router.get('/conversations', authenticate, conversationLimit, conversations.list);
router.get('/conversations/search', authenticate, conversationLimit, conversations.search);
router.get('/conversations/:id/messages', authenticate, conversationLimit, conversations.messages);
router.post('/conversations/:id/messages', authenticate, generationLimit, dailyQuota, chat.sendMessage);
router.post('/conversations/:id/messages/:messageId/regenerate', authenticate, generationLimit, dailyQuota, chat.regenerate);
router.post('/conversations/:id/messages/:messageId/stop', authenticate, generationLimit, chat.stop);
router.get('/conversations/:id', authenticate, conversationLimit, conversations.get);
router.patch('/conversations/:id', authenticate, conversationLimit, conversations.rename);
router.delete('/conversations/:id', authenticate, conversationLimit, conversations.remove);

// Compatibility auth routes for the existing frontend while it moves to /api/v1.
router.post('/credential', authLimit, register);
router.post('/login', authLimit, login);

export default router;
