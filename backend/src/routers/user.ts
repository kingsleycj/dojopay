import nacl from "tweetnacl";
import "dotenv/config";
import { Task } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types/types.js";
import { authMiddleware, workerAuthMiddleware } from "../middlewares/auth.middleware.js";
import { prismaClient } from "../lib/prisma.js";
import { Connection, PublicKey, Transaction, clusterApiUrl } from "@solana/web3.js";
import { JWT_SECRET } from "../index.js";
import { ta } from "zod/locales";
import { TOTAL_DECIMALS } from "../config.js";

const PARENT_WALLET_ADDRESS = "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";

const DEFAULT_TITLE = "Select your preferred choice";
const router = Router();

const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com");

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY || "",
  },
  region: process.env.S3_BUCKET_REGION || "",
});

// signin
router.post("/signin", async(req, res) => {
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into mechanical turks");

    const result = nacl.sign.detached.verify(
        message,
        new Uint8Array(signature.data),
        new PublicKey(publicKey).toBytes(),
    );


    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        })
    }

    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: publicKey
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, JWT_SECRET)

        res.json({
            token
        })
    } else {
        const user = await prismaClient.user.create({
            data: {
                address: publicKey,
            }
        })

        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET)

        res.json({
            token
        })
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
    Conditions: [
        ["content-length-range", 0, 50 * 1024 * 1024],
        ["starts-with", "$Content-Type", "image/"],
    ],
    Fields: {
        success_action_status: "201",
        // Content-Type will be set by the client based on the selected file
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
    const userId = req.userId
    // validate the inputs from the user;
    const body = req.body;

    const parseData = createTaskInput.safeParse(body);

    const user = await prismaClient.user.findFirst({
        where: {
            id: Number(userId)
        }
    })

    if (!parseData.success) {
        return res.status(411).json({
            message: "You've sent the wrong inputs"
        })
    }

    let transaction = await connection.getTransaction(parseData.data.signature, {
        maxSupportedTransactionVersion: 1
    });

    console.log("Transaction found:", transaction);
    console.log("Signature being checked:", parseData.data.signature);

    // If transaction not found, wait a bit and retry
    if (!transaction) {
        console.log("Transaction not found initially, waiting 3 seconds...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        transaction = await connection.getTransaction(parseData.data.signature, {
            maxSupportedTransactionVersion: 1
        });
        
        console.log("Retry transaction found:", transaction);
        
        if (!transaction) {
            return res.status(411).json({
                message: "Transaction not found on blockchain"
            })
        }
    }

    // Check if transaction transferred the correct amount (0.1 SOL = 100000000 lamports)
    const postBalances = transaction?.meta?.postBalances || [];
    const preBalances = transaction?.meta?.preBalances || [];
    
    console.log("Transaction balance details:", {
        postBalances,
        preBalances,
        accountKeys: transaction?.transaction?.message?.accountKeys,
        staticAccountKeys: transaction?.transaction?.message?.staticAccountKeys,
        accountKeysFromGet: transaction?.transaction?.message?.getAccountKeys()
    });

    // Find the parent wallet's balance change - try different ways to access account keys
    let accountKeys = transaction?.transaction?.message?.accountKeys;
    if (!accountKeys) {
        accountKeys = transaction?.transaction?.message?.staticAccountKeys;
    }
    if (!accountKeys) {
        const keys = transaction?.transaction?.message?.getAccountKeys();
        accountKeys = keys ? Array.from(keys) : [];
    }

    if (!accountKeys || accountKeys.length === 0) {
        console.log("No account keys found in transaction");
        return res.status(411).json({
            message: "Transaction signature/amount incorrect - no account keys found"
        })
    }

    const parentWalletIndex = accountKeys.findIndex(
        key => key.toString() === PARENT_WALLET_ADDRESS
    );

    if (parentWalletIndex === -1 || parentWalletIndex === undefined) {
        console.log("Parent wallet not found in transaction");
        return res.status(411).json({
            message: "Transaction signature/amount incorrect - parent wallet not found"
        })
    }

    const balanceChange = (postBalances[parentWalletIndex] ?? 0) - (preBalances[parentWalletIndex] ?? 0);
    
    if (balanceChange !== 100000000) {
        console.log("Balance check failed:", {
            parentWalletIndex,
            postBalance: postBalances[parentWalletIndex],
            preBalance: preBalances[parentWalletIndex],
            balanceChange,
            expected: 100000000
        });
        return res.status(411).json({
            message: "Transaction signature/amount incorrect"
        })
    }

    if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== PARENT_WALLET_ADDRESS) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        })
    }

    if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        })
    }
    // was this money paid by this user address or a different address?

    // parse the signature here to ensure the person has paid 0.1 SOL
    // const transaction = Transaction.from(parseData.data.signature);

    try {
        const task = await prismaClient.task.create({
            data: {
                title: parseData.data.title ?? DEFAULT_TITLE,
                amount: 0.1 * TOTAL_DECIMALS,
                //TODO: Signature should be unique in the table else people can reuse a signature
                signature: parseData.data.signature,
                user_id: Number(userId)
            }
        });

        await prismaClient.option.createMany({
            data: parseData.data.options.map(x => ({
                image_url: x.imageUrl,
                task_id: task.id
            }))
        })

        res.json({
            id: task.id
        })
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            message: "Failed to create task"
        });
    }

})

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
      worker: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageUrl: string;
      };
    }
  > = {};

  taskDetails.options.forEach((option) => {
    const current = result[option.id];
    if (!current) {
      result[option.id] = {
        count: 0,
        option: {
          imageUrl: option.image_url || "",
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
    taskDetails: {
      title: taskDetails.title
    },
    submissions: responses.map(r => ({
        workerId: r.worker_id,
        workerAddress: r.worker.address,
        optionId: r.option_id,
        amount: r.amount,
    }))
  });
});

export default router;
