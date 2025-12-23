import express from 'express';
import userRouter from './routers/user.js';
import workerRouter from './routers/worker.js';
import cors from 'cors';
import { connectDB, prismaClient } from './lib/prisma.js';
const app = express();
app.use(express.json({ limit: '50mb', type: 'application/json' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// CORS configuration for development and production
const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://localhost:5174',
    // Production URLs
    'https://dojopay.vercel.app',
    process.env.FRONTEND_URL
].filter(Boolean);
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
export const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connectivity
        await prismaClient.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            database: 'connected'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            database: 'disconnected',
            error: 'Database connection failed'
        });
    }
});
app.use('/v1/user', userRouter);
app.use('/v1/worker', workerRouter);
const startServer = async () => {
    await connectDB();
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
};
startServer();
export default app;
//# sourceMappingURL=index.js.map