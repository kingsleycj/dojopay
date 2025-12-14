import express from 'express'
import userRouter from './routers/user.ts'
import workerRouter from './routers/worker.ts'
import cors from 'cors'
import { connectDB } from './lib/prisma.ts'

const app = express();
app.use(express.json({ limit: '50mb', type: 'application/json' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000',  'http://localhost:3002'],
    credentials: true
}));

export const JWT_SECRET = "secret";

app.use('/v1/user', userRouter)
app.use('/v1/worker', workerRouter)

const startServer = async () => {
    await connectDB();
    
    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
};

startServer();


export default app;