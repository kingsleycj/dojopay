import "dotenv/config";
import { Task } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types/types.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { prismaClient } from "../lib/prisma.js";

import { JWT_SECRET } from "../index.js";
import { ta } from "zod/locales";

const DEFAULT_TITLE = "Select your preferred choice";
const router = Router();

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY || "",
  },
  region: process.env.S3_BUCKET_REGION || "",
});

// signin
router.post("/signin", async (req, res) => {
  const hardcodedWalletAddress = "4iWViiZVDB65WWTFMHrdyWxBgVNAjn26gBa3edqvawAo";

  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: hardcodedWalletAddress,
    },
  });

  if (!existingUser) {
    const user = await prismaClient.user.create({
      data: {
        address: hardcodedWalletAddress,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET
    );
    res.json({ token });
  } else {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET
    );
    res.json({ token });
  }
});

// get presigned url
router.get("/presignedUrl", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    return res
      .status(500)
      .json({ error: "S3_BUCKET_NAME environment variable not set" });
  }

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: bucketName,
    Key: `dojo/${userId}/${Math.random()}/image.jpg`,
    Conditions: [["content-length-range", 0, 500 * 1024 * 1024]],
    Fields: {
      success_action_status: "201",
      "Content-Type": "image/jpeg",
    },
    Expires: 3600,
  });
  // console.log(url, fields)
  res.json({
    message: "Presigned URL generated successfully",
    presignedUrl: url,
    fields,
  });
});

// create task
router.post("/task", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;

  const parseData = createTaskInput.safeParse(body);

  if (!parseData.success) {
    return res.status(400).json({
      message: "You've sent the wrong inputs",
      error: parseData.error.message,
    });
  }

  // parse the signature here to ensure the person has paid $XX

  try {
    const taskResponse = await prismaClient.$transaction(
      async (tx): Promise<Task> => {
        if (!userId) {
          throw new Error("User ID is required");
        }

        const createdTask = await tx.task.create({
          data: {
            title: parseData.data.title ?? DEFAULT_TITLE,
            amount: "1",
            signature: parseData.data.signature ?? null,
            user_id: userId,
          },
        });

        await tx.option.createMany({
          data: parseData.data.options.map((x: { imageUrl: string }) => ({
            image_url: x.imageUrl,
            task_id: createdTask.id,
          })),
        });
        return createdTask;
      }
    );

    res.json({
      id: taskResponse.id,
    });
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("signature")) {
      return res.status(409).json({
        message: "A task with this signature already exists",
        error: "Duplicate signature",
      });
    }
    throw error;
  }
});

// get task
router.get("/task", authMiddleware, async (req, res) => {
  const taskId = req.query.taskId;
  const userId = req.userId;

  if (!taskId || !userId) {
    return res.status(400).json({
      message: "taskId and userId are required",
    });
  }

  const taskDetails = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!taskDetails) {
    return res.status(411).json({
      message: "You don't have access to this task",
    });
  }

  const responses = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageurl: string;
      };
    }
  > = {};

  taskDetails.options.forEach((option) => {
    const current = result[option.id];
    if (!current) {
      result[option.id] = {
        count: 0,
        option: {
          imageurl: option.image_url || "",
        },
      };
    }
  });

  responses.forEach((r) => {
    if (result[r.option_id]) {
      result[r.option_id].count++;
    }
  });

  res.json({
    result,
  });
});

export default router;
