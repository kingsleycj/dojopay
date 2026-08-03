import app from "./app.js";
import { assertConfigValid, config } from "./config/index.js";
import { connectDB, disconnectDB } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { expireStaleTasks } from "./services/task.service.js";
/**
 * Server bootstrap. Nothing but wiring — the app itself lives in `app.ts`.
 */
/** How often to sweep expired tasks into their terminal state. */
const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
async function main() {
    assertConfigValid();
    await connectDB();
    const sweeper = setInterval(() => {
        expireStaleTasks().catch((error) => logger.error("Expiry sweep failed", {
            error: error instanceof Error ? error.message : String(error),
        }));
    }, EXPIRY_SWEEP_INTERVAL_MS);
    sweeper.unref();
    const server = app.listen(config.port, () => {
        logger.info("Server listening", { port: config.port, environment: config.env });
    });
    const shutdown = async (signal) => {
        logger.info("Shutting down", { signal });
        clearInterval(sweeper);
        server.close();
        await disconnectDB();
        process.exit(0);
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}
main().catch((error) => {
    logger.error("Failed to start server", {
        error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});
export { app };
export default app;
//# sourceMappingURL=index.js.map