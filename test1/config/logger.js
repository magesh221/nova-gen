import { inspect } from 'node:util';
import { env } from './env.js';

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = levels[env.logLevel] ? env.logLevel : 'info';

function write(level, message, fields = {}) {
    if (levels[level] < levels[configuredLevel]) return;

    const record = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...fields,
    };

    if (env.nodeEnv === 'production') {
        const output = JSON.stringify(record);
        (level === 'error' ? console.error : console.log)(output);
        return;
    }

    const { timestamp, ...details } = record;
    const suffix = Object.keys(details).length > 2
        ? ` ${inspect(Object.fromEntries(Object.entries(details).filter(([key]) => key !== 'level' && key !== 'message')), { colors: true, depth: 3, breakLength: 100 })}`
        : '';
    const output = `${timestamp} ${level.toUpperCase()} ${message}${suffix}`;
    (level === 'error' ? console.error : console.log)(output);
}

export const logger = Object.freeze({
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
});
