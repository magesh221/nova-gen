import crypto from 'node:crypto';
import User from '../models/users.js';
import RefreshSession from '../models/refreshSessions.js';
import PasswordResetToken from '../models/passwordResetTokens.js';
import { hashedPassword, comparePassword } from '../middleware/helper.js';
import { env } from '../config/env.js';
import { createJwt, hashToken } from './tokens.js';
import { sendPasswordResetEmail } from './email.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
    if (typeof value !== 'string') throw new HttpError(400, 'Enter a valid email address', 'INVALID_EMAIL');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address', 'INVALID_EMAIL');
    return email;
}

export function validatePassword(value) {
    if (typeof value !== 'string' || value.length < 10 || Buffer.byteLength(value, 'utf8') > 72) {
        throw new HttpError(400, 'Password must be at least 10 characters and no more than 72 UTF-8 bytes', 'INVALID_PASSWORD');
    }
    return value;
}

export function toPublicUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
    };
}

export async function createAuthSession(user) {
    const refreshTtlSeconds = env.refreshTtlDays * 24 * 60 * 60;
    const accessToken = createJwt({ userId: user._id, type: 'access', ttlSeconds: env.accessTtlSeconds });
    const refreshToken = createJwt({ userId: user._id, type: 'refresh', ttlSeconds: refreshTtlSeconds });
    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);
    await RefreshSession.create({ userId: user._id, tokenHash: hashToken(refreshToken), expiresAt });
    return { accessToken, refreshToken, accessMaxAge: env.accessTtlSeconds * 1000, refreshMaxAge: refreshTtlSeconds * 1000 };
}

export async function registerUser({ name, email, password }) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
        throw new HttpError(400, 'Name is required and must be 80 characters or fewer', 'INVALID_NAME');
    }
    const normalizedEmail = validateEmail(email);
    const validPassword = validatePassword(password);
    const passwordHash = await hashedPassword(validPassword);

    try {
        return await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });
    } catch (error) {
        if (error?.code === 11000) throw new HttpError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
        throw error;
    }
}

export async function loginUser({ email, password }) {
    const normalizedEmail = validateEmail(email);
    if (typeof password !== 'string' || !password) throw new HttpError(400, 'Email and password are required', 'INVALID_CREDENTIALS');

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +password');
    const passwordHash = user?.passwordHash || user?.password;
    if (!user || user.status !== 'active' || !passwordHash || !(await comparePassword(password, passwordHash))) {
        logger.warn('Authentication failed', { event: 'login_failed' });
        throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.passwordHash && user.password) {
        await User.updateOne({ _id: user._id }, { $set: { passwordHash: user.password }, $unset: { password: 1 } });
    }
    user.lastLoginAt = new Date();
    await user.save();
    logger.info('Authentication successful', { event: 'login_success', userId: user._id.toString() });
    return user;
}

export async function revokeRefreshToken(refreshToken) {
    if (refreshToken) await RefreshSession.deleteOne({ tokenHash: hashToken(refreshToken) });
}

export async function rotateRefreshToken(refreshToken, payload) {
    const session = await RefreshSession.findOneAndDelete({
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        expiresAt: { $gt: new Date() },
    });
    if (!session) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');

    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw new HttpError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
    return { user, session: await createAuthSession(user) };
}

export async function requestPasswordReset(email) {
    if (!env.smtp || !env.passwordResetFrontendUrl) {
        throw new HttpError(503, 'Password recovery is not configured. Please contact support.', 'EMAIL_NOT_CONFIGURED');
    }

    const user = await User.findOne({ email: validateEmail(email), status: 'active' });
    if (!user) return;

    await PasswordResetToken.deleteMany({ userId: user._id });
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash: hashToken(token), expiresAt });

    try {
        await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    } catch (error) {
        await PasswordResetToken.deleteOne({ tokenHash: hashToken(token) });
        throw error;
    }
    logger.info('Password reset email sent', { event: 'password_reset_requested', userId: user._id.toString() });
}

export async function resetPassword({ token, password }) {
    const validPassword = validatePassword(password);
    if (typeof token !== 'string' || token.length < 30 || token.length > 200) {
        throw new HttpError(400, 'Reset link is invalid or expired', 'INVALID_RESET_TOKEN');
    }

    const tokenRecord = await PasswordResetToken.findOneAndDelete({
        tokenHash: hashToken(token),
        expiresAt: { $gt: new Date() },
    });
    if (!tokenRecord) throw new HttpError(400, 'Reset link is invalid or expired', 'INVALID_RESET_TOKEN');

    const passwordHash = await hashedPassword(validPassword);
    const user = await User.findByIdAndUpdate(tokenRecord.userId, {
        $set: { passwordHash, passwordChangedAt: new Date() },
        $unset: { password: 1 },
    }, { new: true });
    if (!user) throw new HttpError(400, 'Reset link is invalid or expired', 'INVALID_RESET_TOKEN');

    await Promise.all([
        RefreshSession.deleteMany({ userId: user._id }),
        PasswordResetToken.deleteMany({ userId: user._id }),
    ]);
    logger.info('Password reset completed', { event: 'password_reset_completed', userId: user._id.toString() });
}
