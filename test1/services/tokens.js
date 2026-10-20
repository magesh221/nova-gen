import crypto from 'node:crypto';
import { env } from '../config/env.js';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function signature(input, secret) {
    return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function createJwt({ userId, type, ttlSeconds }) {
    const now = Math.floor(Date.now() / 1000);
    const secret = type === 'access' ? env.jwtAccessSecret : env.jwtRefreshSecret;
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: String(userId), typ: type, iat: now, exp: now + ttlSeconds, jti: crypto.randomUUID() });
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyJwt(token, expectedType) {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (header.alg !== 'HS256' || header.typ !== 'JWT' || payload.typ !== expectedType) return null;

        const secret = expectedType === 'access' ? env.jwtAccessSecret : env.jwtRefreshSecret;
        const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`, secret));
        const received = Buffer.from(parts[2]);
        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
        if (!payload.sub || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}
