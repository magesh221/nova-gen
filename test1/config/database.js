import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase() {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10_000,
    });
    logger.info('MongoDB connected');
    return mongoose.connection;
}

export async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
    }
}
