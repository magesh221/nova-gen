import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve .env relative to this backend, not the shell/PM2 working directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const required = (name, value) => {
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
};

const parseUrl = (name, value) => {
    const raw = required(name, value);
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error(`${name} must be a valid URL`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`${name} must use HTTP or HTTPS`);
    }
    return raw.replace(/\/$/, '');
};

const positiveInteger = (name, rawValue, fallback) => {
    const value = Number(rawValue || fallback);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
    return value;
};

const accessSecret = required('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET);
const refreshSecret = required('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters');
}

const smtpValues = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
const smtpConfiguredCount = smtpValues.filter((key) => Boolean(process.env[key])).length;
if (smtpConfiguredCount > 0 && smtpConfiguredCount < smtpValues.length) {
    throw new Error(`Configure all SMTP variables together: ${smtpValues.join(', ')}`);
}
const frontendOrigins = required('FRONTEND_URL', process.env.FRONTEND_URL || process.env.CorsUrl)
    .split(',').map((origin) => origin.trim()).filter(Boolean)
    .map((origin) => {
        try { return new URL(origin).origin; } catch { throw new Error('FRONTEND_URL must contain valid origins'); }
    });
const smtpPort = positiveInteger('SMTP_PORT', process.env.SMTP_PORT, 587);
const trustProxyValue = process.env.TRUST_PROXY || 'false';
const trustProxy = trustProxyValue === 'true' ? 1
    : trustProxyValue === 'false' ? false
        : positiveInteger('TRUST_PROXY', trustProxyValue, 1);

export const env = Object.freeze({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 8690),
    trustProxy,
    mongoUri: required('MONGODB_URI', process.env.MONGODB_URI || process.env.DB_STRING),
    jwtAccessSecret: accessSecret,
    jwtRefreshSecret: refreshSecret,
    aiApiKey: required('AI_API_KEY', process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY),
    aiBaseUrl: parseUrl('AI_BASE_URL', process.env.AI_BASE_URL || process.env.OPENROUTER_URL),
    aiModel: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    aiContextMessages: positiveInteger('AI_CONTEXT_MESSAGES', process.env.AI_CONTEXT_MESSAGES, 20),
    aiMaxOutputTokens: positiveInteger('AI_MAX_OUTPUT_TOKENS', process.env.AI_MAX_OUTPUT_TOKENS, 1500),
    aiTimeoutMs: positiveInteger('AI_TIMEOUT_MS', process.env.AI_TIMEOUT_MS, 60_000),
    frontendOrigins,
    logLevel: process.env.LOG_LEVEL || 'info',
    accessTtlSeconds: positiveInteger('AUTH_ACCESS_TTL_SECONDS', process.env.AUTH_ACCESS_TTL_SECONDS, 900),
    refreshTtlDays: positiveInteger('AUTH_REFRESH_TTL_DAYS', process.env.AUTH_REFRESH_TTL_DAYS, 30),
    authDailyMessageLimit: positiveInteger('AUTH_DAILY_MESSAGE_LIMIT', process.env.AUTH_DAILY_MESSAGE_LIMIT, 100),
    smtp: smtpConfiguredCount === smtpValues.length ? {
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.SMTP_FROM,
    } : null,
    passwordResetFrontendUrl: process.env.PASSWORD_RESET_FRONTEND_URL
        ? parseUrl('PASSWORD_RESET_FRONTEND_URL', process.env.PASSWORD_RESET_FRONTEND_URL)
        : null,
});

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}
if (env.frontendOrigins.length === 0) {
    throw new Error('FRONTEND_URL must contain at least one allowed origin');
}
