import User from '../models/users.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { authenticate, readRefreshCookie } from '../middleware/authenticate.js';
import { HttpError } from '../utils/httpError.js';
import {
    createAuthSession,
    loginUser,
    registerUser,
    requestPasswordReset,
    resetPassword,
    revokeRefreshToken,
    rotateRefreshToken,
    toPublicUser,
} from '../services/auth.js';
import { verifyJwt } from '../services/tokens.js';

const accessCookie = 'nova_access';
const refreshCookie = 'nova_refresh';
const cookieOptions = { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/' };

function setSessionCookies(res, session) {
    res.cookie(accessCookie, session.accessToken, { ...cookieOptions, maxAge: session.accessMaxAge });
    res.cookie(refreshCookie, session.refreshToken, { ...cookieOptions, maxAge: session.refreshMaxAge });
}

function clearSessionCookies(res) {
    res.clearCookie(accessCookie, cookieOptions);
    res.clearCookie(refreshCookie, cookieOptions);
}

export async function register(req, res, next) {
    try {
        const user = await registerUser(req.body || {});
        const session = await createAuthSession(user);
        setSessionCookies(res, session);
        logger.info('Account registered', { event: 'registration_success', userId: user._id.toString() });
        res.status(201).json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
        if (error.code === 11000) error.statusCode = 409;
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        const user = await loginUser(req.body || {});
        const session = await createAuthSession(user);
        setSessionCookies(res, session);
        res.json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
        next(error);
    }
}

export async function logout(req, res, next) {
    try {
        await revokeRefreshToken(readRefreshCookie(req));
        clearSessionCookies(res);
        res.json({ success: true, data: { signedOut: true } });
    } catch (error) {
        next(error);
    }
}

export async function refresh(req, res, next) {
    try {
        const token = readRefreshCookie(req);
        const payload = verifyJwt(token, 'refresh');
        if (!payload) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
        const { user, session } = await rotateRefreshToken(token, payload);
        setSessionCookies(res, session);
        res.json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
        clearSessionCookies(res);
        next(error);
    }
}

export async function me(req, res, next) {
    try {
        const user = await User.findById(req.auth.userId);
        if (!user || user.status !== 'active') throw new HttpError(401, 'Please sign in to continue', 'AUTH_REQUIRED');
        res.json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
        next(error);
    }
}

export async function forgotPassword(req, res, next) {
    try {
        await requestPasswordReset(req.body?.email);
        res.status(202).json({
            success: true,
            data: { message: 'If an account matches that email, a password reset link will be sent.' },
        });
    } catch (error) {
        next(error);
    }
}

export async function resetPasswordHandler(req, res, next) {
    try {
        await resetPassword(req.body || {});
        clearSessionCookies(res);
        res.json({ success: true, data: { message: 'Password reset successfully. Please sign in again.' } });
    } catch (error) {
        next(error);
    }
}

export const requireAuth = authenticate;
