import test from 'node:test';
import assert from 'node:assert/strict';
import Conversation from '../models/conversations.js';
import { authenticate } from '../middleware/authenticate.js';
import router from '../router/router.js';
import { findOwnedConversation } from '../services/conversations.js';

const conversationId = '65c2ab704bb92c861f999999';
const ownerId = '65c2ab704bb92c861f111111';
const otherUserId = '65c2ab704bb92c861f222222';

test('private API authentication rejects a request without a session', async () => {
    let nextError;
    await authenticate({ get: () => undefined }, {}, (error) => { nextError = error; });
    assert.equal(nextError.statusCode, 401);
    assert.equal(nextError.code, 'AUTH_REQUIRED');
});

test('all conversation API routes authenticate first and no guest generation route remains', () => {
    const routes = router.stack.filter((layer) => layer.route).map((layer) => layer.route);
    const conversationRoutes = routes.filter((route) => String(route.path).startsWith('/conversations'));
    assert.ok(conversationRoutes.length > 0);
    for (const route of conversationRoutes) assert.equal(route.stack[0].handle.name, 'authenticate');
    assert.equal(routes.some((route) => route.path === '/generate'), false);
});

test('conversation ownership allows its owner and returns 403 for another account', async (context) => {
    context.mock.method(Conversation, 'findById', async () => ({
        _id: conversationId,
        userId: { toString: () => ownerId },
        archived: false,
    }));

    assert.equal((await findOwnedConversation(conversationId, ownerId))._id, conversationId);
    await assert.rejects(findOwnedConversation(conversationId, otherUserId), { statusCode: 403, code: 'FORBIDDEN' });
});
