
import { logger } from '../config/logger.js';

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : (Number.isInteger(err.status) ? err.status : 500);
    logger.error('Request failed', {
        requestId: req.requestId,
        statusCode,
        errorCode: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    res.status(statusCode).json({
        success: false,
        message: statusCode >= 500 ? 'An unexpected server error occurred' : err.message,
        code: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
        requestId: req.requestId,
    });
};

export default errorHandler;
