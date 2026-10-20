import { HttpError } from '../utils/httpError.js';

const windows = new Map();

export function rateLimit({ name, limit, windowMs }) {
    return (req, res, next) => {
        const now = Date.now();
        const key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
        let entry = windows.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            windows.set(key, entry);
        }

        if (entry.count >= limit) {
            const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfterSeconds));
            return next(new HttpError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED'));
        }

        entry.count += 1;
        if (windows.size > 5000) {
            for (const [storedKey, storedValue] of windows) {
                if (storedValue.resetAt <= now) windows.delete(storedKey);
            }
        }
        next();
    };
}
