import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Router from './router/router.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);

// Logs
app.use((req, res, next) => {
    const suppliedRequestId = req.get('x-request-id');
    req.requestId = suppliedRequestId && /^[A-Za-z0-9_-]{1,100}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : crypto.randomUUID();
    res.set('X-Request-Id', req.requestId);
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
    });
    const startedAt = Date.now();
    res.on('finish', () => logger.info('HTTP request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
    }));
    next();
});

// Cors
app.use(cors({
    origin(origin, callback) {
        if (!origin || env.frontendOrigins.includes(origin)) return callback(null, true);
        const error = new Error('Origin is not allowed by CORS');
        error.statusCode = 403;
        return callback(error);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
    maxAge: 600,
}));

// Body parsers
app.use(express.json({ limit: '64kb' }));
// The `extended` option allows you to choose between parsing the URL-encoded data with the querystring library (when `false`) or the qs library (when `true`). The `limit` option specifies the maximum size of the request body. In this case, it is set to 16 kilobytes.
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// Health and readiness endpoints
app.get('/api/v1/health', (_req, res) => res.json({ success: true, status: 'ok' }));
// The readiness endpoint checks if the database connection is established. If the database is connected, it returns a 200 status code; otherwise, it returns a 503 status code indicating that the service is not ready.
app.get('/api/v1/ready', (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
        success: databaseReady,
        status: databaseReady ? 'ready' : 'not_ready',
        checks: { database: databaseReady ? 'connected' : 'disconnected' },
    });
});

// Keep the old prefix available until the frontend has moved to the versioned API.
app.use('/api/v1', Router);
app.use('/api', Router);

// Error handling
app.use((req, res) => res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.requestId,
}));
app.use(errorHandler);

export default app;
