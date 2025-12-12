import express from 'express'
import userRouter from './routers/user.ts'
import workerRouter from './routers/worker.ts'


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export const JWT_SECRET = "secret";

app.use('/v1/user', userRouter)
app.use('/v1/worker', workerRouter)

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

export default app;