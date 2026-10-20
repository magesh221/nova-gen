import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMessage } from '../services/chat.js';

test('chat input validation trims content and accepts a stable client ID', () => {
    assert.equal(validateMessage({ content: '  hello  ', clientMessageId: 'client-id_123' }), 'hello');
});

test('chat input validation rejects empty, oversized, and unkeyed submissions', () => {
    assert.throws(() => validateMessage({ content: '  ', clientMessageId: 'client-id_123' }), { code: 'INVALID_MESSAGE' });
    assert.throws(() => validateMessage({ content: 'x'.repeat(12_001), clientMessageId: 'client-id_123' }), { code: 'INVALID_MESSAGE' });
    assert.throws(() => validateMessage({ content: 'hello', clientMessageId: 'short' }), { code: 'INVALID_CLIENT_MESSAGE_ID' });
});
