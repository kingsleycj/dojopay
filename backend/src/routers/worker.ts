import { Router } from "express";
import { prismaClient } from "../lib/prisma.ts";
import JWT_SECRET from "../index.ts";
import jwt from "jsonwebtoken";
import { workerAuthMiddleware } from "../middlewares/auth.middleware.ts";
export const WORKER_JWT_SECRET = JWT_SECRET + "worker";

const router = Router();

// signin
router.post("/signin", async (req, res) => {
  const hardcodedWalletAddress = "4iWViiZVDB65WWTFMHrdyWxBgVNAjn26gBa3edqvawAo";

  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: hardcodedWalletAddress,
    },
  });

  if (!existingUser) {
    const user = await prismaClient.worker.create({
      data: {
        address: hardcodedWalletAddress,
        pending_amount: 0,
        locked_amount: 0,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      WORKER_JWT_SECRET
    );
    res.json({ token });
  } else {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      WORKER_JWT_SECRET
    );
    res.json({ token });
  }
});

// nextTask
router.get("/nextTask", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const task = await prismaClient.task.findFirst({
    where: {
      done: false,
      submissions: {
        none: {
          worker_id: userId,
        },
      },
    },
    select: {
      title: true,
      options: true,
    },
  });

  if (!task) {
    res.status(404).json({
      message: "No available tasks for you to review",
    });
  } else {
    res.status(200).json({
      task,
    });
  }
});

export default router;
