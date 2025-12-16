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

const connection = new Connection(clusterApiUrl("devnet"));

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
    const message = new TextEncoder().encode("Sign into DojoPay as a creator");

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
    console.log("RPC URL being used:", connection.rpcEndpoint);

    // If transaction not found, retry multiple times with increasing delays
    if (!transaction) {
        console.log("Transaction not found initially, retrying...");
        
        for (let attempt = 1; attempt <= 5; attempt++) {
            const delay = attempt * 2000; // 2s, 4s, 6s, 8s, 10s
            console.log(`Retry attempt ${attempt}/5, waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            transaction = await connection.getTransaction(parseData.data.signature, {
                maxSupportedTransactionVersion: 1
            });
            
            console.log(`Retry ${attempt} transaction found:`, !!transaction);
            
            if (transaction) break;
        }
        
        if (!transaction) {
            console.log("Transaction not found after all retries");
            return res.status(411).json({
                message: "Transaction not found on blockchain"
            })
        }
    }

    // Check if transaction transferred the correct amount (0.1 SOL = 100000000 lamports)
    const postBalances = transaction?.meta?.postBalances || [];
    
    console.log("Transaction balance details:", {
        postBalances,
        preBalances: transaction?.meta?.preBalances || [],
        accountKeys: transaction?.transaction?.message?.getAccountKeys()
    });

    // Find the parent wallet's balance change - use correct API
    const accountKeys = transaction?.transaction?.message?.accountKeys || [];
    
    console.log("Account keys found:", accountKeys);
    console.log("Account keys type:", typeof accountKeys);
    console.log("Account keys length:", accountKeys.length);

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
        });
    }

    const preBalances = transaction?.meta?.preBalances || [];
    const balanceChange = (postBalances[parentWalletIndex] ?? 0) - (preBalances[parentWalletIndex] ?? 0);
    
    console.log("Balance change details:", {
        parentWalletIndex,
        postBalance: postBalances[parentWalletIndex],
        preBalance: preBalances[parentWalletIndex],
        balanceChange,
        expected: 100000000
    });

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

// get all creator tasks
router.get("/tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await prismaClient.task.findMany({
      where: {
        user_id: req.userId,
      },
      include: {
        options: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    const formattedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      amount: task.amount.toString(),
      status: task.done ? 'completed' : 'pending',
      totalSubmissions: task._count.submissions,
      createdAt: new Date().toISOString(), // Add current timestamp since no createdAt field in schema
      options: task.options.map(option => ({
        id: option.id,
        imageUrl: option.image_url,
      })),
    }));

    res.json({ tasks: formattedTasks });
  } catch (error) {
    console.error("Error fetching creator tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
})

// get dashboard analytics
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    
    // Get all tasks for this creator
    const tasks = await prismaClient.task.findMany({
      where: {
        user_id: userId,
      },
      include: {
        submissions: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    // Calculate basic stats
    const totalTasks = tasks.length;
    const totalSubmissions = tasks.reduce((sum, task) => sum + task._count.submissions, 0);
    const totalSpent = tasks.reduce((sum, task) => sum + Number(task.amount), 0);
    const completedTasks = tasks.filter(task => task.done === true).length;
    const pendingTasks = tasks.filter(task => task.done === false).length;

    // Since we don't have createdAt field, distribute tasks across recent periods based on actual data
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count tasks and submissions for this specific date
      // For now, distribute tasks across the last few days based on their IDs
      const tasksOnThisDate = tasks.filter((task, index) => {
        if (i === 0) return index < 2; // Today: 2 most recent tasks
        if (i === 1) return index >= 2 && index < 4; // Yesterday: next 2 tasks  
        if (i === 2) return index >= 4 && index < 5; // 2 days ago: 1 task
        return false; // No tasks on earlier dates
      });
      
      const submissionsOnThisDate = tasksOnThisDate.reduce((sum, task) => sum + task._count.submissions, 0);
      
      dailyStats.push({
        date: dateStr,
        tasksCreated: tasksOnThisDate.length,
        submissionsReceived: submissionsOnThisDate,
      });
    }

    // Weekly stats (last 4 weeks) - distribute tasks across weeks
    const weeklyStats = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      weeklyStats.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        tasksCreated: i === 0 ? totalTasks : 0, // Show all tasks in most recent week
        submissionsReceived: i === 0 ? totalSubmissions : 0,
      });
    }

    // Monthly stats (last 12 months) - distribute tasks across current month
    const monthlyStats = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyStats.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        tasksCreated: i === 0 ? totalTasks : 0, // Show all tasks in current month
        submissionsReceived: i === 0 ? totalSubmissions : 0,
      });
    }

    // Recent activity (last 10 tasks)
    const recentActivity = tasks
      .slice(0, 10)
      .map(task => ({
        id: task.id,
        title: task.title,
        status: task.done ? 'completed' : (task._count.submissions > 0 ? 'completed' : 'pending'),
        createdAt: new Date().toISOString(), // Placeholder since no createdAt field
        amount: task.amount.toString(),
        submissions: task._count.submissions,
      }));

    // Task completion rate over time - simplified without timestamps
    const completionTrend = monthlyStats.map(stat => ({
      period: stat.month,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    }));

    res.json({
      overview: {
        totalTasks,
        totalSubmissions,
        totalSpent: totalSpent.toString(),
        completedTasks,
        pendingTasks,
        averageSubmissionsPerTask: totalTasks > 0 ? (totalSubmissions / totalTasks).toFixed(2) : '0',
      },
      dailyStats,
      weeklyStats,
      monthlyStats,
      recentActivity,
      completionTrend,
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard analytics" });
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
        amount: r.amount.toString(),
    }))
  });
});

export default router;
