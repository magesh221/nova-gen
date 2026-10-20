import test from 'node:test';
import assert from 'node:assert/strict';
import { createJwt, verifyJwt } from '../services/tokens.js';
import { validateEmail, validatePassword } from '../services/auth.js';

test('email validation normalizes valid addresses', () => {
    assert.equal(validateEmail('  Magesh@example.com '), 'magesh@example.com');
});

test('email validation rejects malformed addresses', () => {
    assert.throws(() => validateEmail('not-an-email'), { statusCode: 400 });
});

test('password validation accepts bcrypt-compatible passphrases', () => {
    assert.equal(validatePassword('correct horse battery staple'), 'correct horse battery staple');
});

test('password validation rejects short and oversized passwords', () => {
    assert.throws(() => validatePassword('short'), { statusCode: 400 });
    assert.throws(() => validatePassword('🔐'.repeat(40)), { statusCode: 400 });
});

test('access tokens verify for their intended token type', () => {
    const token = createJwt({ userId: 'user-123', type: 'access', ttlSeconds: 60 });
    assert.equal(verifyJwt(token, 'access')?.sub, 'user-123');
    assert.equal(verifyJwt(token, 'refresh'), null);
});

test('tampered and expired tokens are rejected', () => {
    const token = createJwt({ userId: 'user-123', type: 'access', ttlSeconds: 60 });
    assert.equal(verifyJwt(`${token.slice(0, -1)}x`, 'access'), null);
    const expired = createJwt({ userId: 'user-123', type: 'access', ttlSeconds: -1 });
    assert.equal(verifyJwt(expired, 'access'), null);
});
