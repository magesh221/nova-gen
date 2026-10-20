import User from '../models/users.js';
import { verifyJwt } from '../services/tokens.js';
import { HttpError } from '../utils/httpError.js';

function readCookie(header, name) {
    if (!header) return null;
    for (const item of header.split(';')) {
        const separator = item.indexOf('=');
        if (separator < 0) continue;
        if (item.slice(0, separator).trim() === name) {
            try { return decodeURIComponent(item.slice(separator + 1).trim()); } catch { return null; }
        }
    }
    return null;
}

export async function authenticate(req, _res, next) {
    try {
        const authorization = req.get('authorization');
        const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const token = bearer || readCookie(req.get('cookie'), 'nova_access');
        const payload = verifyJwt(token, 'access');
        if (!payload) throw new HttpError(401, 'Please sign in to continue', 'AUTH_REQUIRED');

        const user = await User.findById(payload.sub).select('_id status passwordChangedAt');
        if (!user || user.status !== 'active' || (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime())) {
            throw new HttpError(401, 'Please sign in to continue', 'AUTH_REQUIRED');
        }

        req.auth = { userId: user._id.toString() };
        next();
    } catch (error) {
        next(error);
    }
}

export function readRefreshCookie(req) {
    return readCookie(req.get('cookie'), 'nova_refresh');
}
