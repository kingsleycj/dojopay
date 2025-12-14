import express from 'express'
import userRouter from './routers/user.ts'
import workerRouter from './routers/worker.ts'
import cors from 'cors'
import { connectDB } from './lib/prisma.ts'

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
    // Add your Vercel frontend URL here after deployment
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

export const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";

app.use('/v1/user', userRouter)
app.use('/v1/worker', workerRouter)

const startServer = async () => {
    await connectDB();
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
};

startServer();

export default app;