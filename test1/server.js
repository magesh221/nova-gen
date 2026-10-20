import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './config/logger.js';

let server;
let shuttingDown = false;

// Graceful shutdown function that handles server shutdown and database disconnection
async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Server shutdown started', { signal });

    const timeout = setTimeout(() => {
        logger.error('Graceful shutdown timed out');
        process.exit(1);
    }, 10_000);
    timeout.unref();

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
    clearTimeout(timeout);
    logger.info('Server shutdown complete');
    process.exit(exitCode);
}
// The code above sets up a Node.js server with Express, including middleware for logging, CORS, body parsing, and health/readiness endpoints. It also includes a graceful shutdown mechanism to handle termination signals and uncaught exceptions. The server connects to a database on startup and disconnects on shutdown.
try {
    await connectDatabase();
    server = app.listen(env.port);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    logger.info('Server listening', { port: env.port, environment: env.nodeEnv });
} catch (error) {
    logger.error('Server startup failed', { error: error.message });
    await disconnectDatabase().catch(() => {});
    process.exitCode = 1;
}


// This below code handles a shutdown singnal and uncaught exceptions. It ensures that the server and database are properly closed before exiting the process. The shutdown function is called with the appropriate signal and exit code, and it logs the shutdown process for debugging purposes.
// The code above attempts to connect to the database and start the server. If successful, it logs that the server is listening. If there is an error during startup, it logs the error, disconnects from the database, and sets the process exit code to 1.
process.on('SIGINT', () => void shutdown('SIGINT'));
// The code above sets up signal handlers for graceful shutdown. When the process receives a SIGINT (e.g., from Ctrl+C), it calls the shutdown function to cleanly close the server and disconnect from the database.
process.on('SIGTERM', () => void shutdown('SIGTERM'));
// The code above sets up a signal handler for the SIGTERM signal, which is typically sent to a process to request its termination. When the process receives a SIGTERM signal, it calls the shutdown function to gracefully shut down the server and disconnect from the database.
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: env.nodeEnv === 'development' ? error.stack : undefined });
    void shutdown('uncaughtException', 1);
});
// The code above sets up a handler for uncaught exceptions in the Node.js process. If an uncaught exception occurs, it logs the error message and stack trace (if in development mode) and then calls the shutdown function to gracefully shut down the server and disconnect from the database, exiting with a status code of 1.
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: reason instanceof Error ? reason.message : 'Unknown rejection' });
    void shutdown('unhandledRejection', 1);
});
