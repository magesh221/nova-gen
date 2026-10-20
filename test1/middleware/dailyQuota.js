import crypto from 'node:crypto';
import DailyUsage from '../models/dailyUsage.js';
import Message from '../models/messages.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function dailyQuota(req, _res, next) {
    const isRegeneration = req.path.endsWith('/regenerate');
    const persistedInputValid = isRegeneration || (
        typeof req.body?.content === 'string' && req.body.content.trim().length > 0 && req.body.content.trim().length <= 12_000 &&
        typeof req.body?.clientMessageId === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(req.body.clientMessageId)
    );
    if (!persistedInputValid) return next();

    const identity = `user:${req.auth.userId}`;
    const key = crypto.createHash('sha256').update(identity).digest('hex');
    const date = new Date().toISOString().slice(0, 10);
    const limit = env.authDailyMessageLimit;

    void (async () => {
        try {
            if (req.params.id && req.body?.clientMessageId) {
                const alreadySubmitted = await Message.exists({
                    conversationId: req.params.id,
                    userId: req.auth.userId,
                    role: 'user',
                    clientMessageId: req.body.clientMessageId,
                });
                if (alreadySubmitted) return next();
            }
            const expiresAt = new Date(`${date}T00:00:00.000Z`);
            expiresAt.setUTCDate(expiresAt.getUTCDate() + 45);
            let usage;
            try {
                usage = await DailyUsage.findOneAndUpdate(
                    { key, date, count: { $lt: limit } },
                    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
                    { new: true, upsert: true, setDefaultsOnInsert: true },
                );
            } catch (error) {
                if (error?.code !== 11000) throw error;
                usage = await DailyUsage.findOneAndUpdate(
                    { key, date, count: { $lt: limit } },
                    { $inc: { count: 1 } },
                    { new: true },
                );
            }
            if (!usage) throw new HttpError(429, 'Daily chat limit reached. Please try again tomorrow.', 'DAILY_MESSAGE_LIMIT');
            return next();
        } catch (error) {
            return next(error);
        }
    })();
}
