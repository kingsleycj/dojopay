import nacl from "tweetnacl";
import { Router } from "express";
import { prismaClient } from "../lib/prisma.js";
import JWT_SECRET from "../index.js";
import jwt from "jsonwebtoken";
import { workerAuthMiddleware } from "../middlewares/auth.middleware.js";
import { getNextTask } from "../db.js";
import { createSubmissionInput } from "../types/types.js";
import { TOTAL_DECIMALS } from "../config.js";
export const WORKER_JWT_SECRET = JWT_SECRET + "worker";
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction, 
  Keypair,
  clusterApiUrl
} from "@solana/web3.js";
import bs58 from "bs58";
import { privateKey } from "../privateKey.js";

const PARENT_WALLET_ADDRESS = "FPDb9L6L3kyBiw8LeXCcdza85PbSNxcZujXNkPrwEont";
const connection = new Connection(clusterApiUrl("devnet"));
const TOTAL_SUBMISSIONS = 100;

prismaClient.$transaction(
    async (prisma) => {
      // Code running in a transaction...
    },
    {
      maxWait: 5000, // default: 2000
      timeout: 10000, // default: 5000
    }
)

const router = Router();

// signin
router.post("/signin", async(req, res) => {
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into DojoPay as a worker");

    console.log("Worker signin debug:");
    console.log("Public key:", publicKey);
    console.log("Signature type:", typeof signature);
    console.log("Signature:", signature);
    console.log("Signature constructor:", signature?.constructor?.name);
    console.log("Is array:", Array.isArray(signature));
    console.log("Signature length:", signature?.length || 'undefined');

    // Handle different signature formats
    let signatureBytes;
    if (signature.data) {
        // Old format with data property
        signatureBytes = new Uint8Array(signature.data);
        console.log("Using signature.data format");
    } else if (Array.isArray(signature)) {
        // Array format
        signatureBytes = new Uint8Array(signature);
        console.log("Using array format");
    } else if (typeof signature === 'string') {
        // Base64 string format
        signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        console.log("Using base64 string format");
    } else {
        // Direct Uint8Array or Buffer
        signatureBytes = new Uint8Array(signature);
        console.log("Using direct format");
    }

    console.log("Final signature bytes length:", signatureBytes.length);
    console.log("Message bytes length:", message.length);

    const result = nacl.sign.detached.verify(
        message,
        signatureBytes,
        new PublicKey(publicKey).toBytes(),
    );

    console.log("Verification result:", result);

    if (!result) {
        return res.status(401).json({
            message: "Invalid signature"
        })
    }

    const existingUser = await prismaClient.worker.findFirst({
        where: {
            address: publicKey
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            workerId: existingUser.id
        }, WORKER_JWT_SECRET)

        res.json({
            token,
            amount: Number(existingUser.pending_amount) / TOTAL_DECIMALS
        })
    } else {
        const user = await prismaClient.worker.create({
            data: {
                address: publicKey,
                pending_amount: 0,
                locked_amount: 0
            }
        });

        const token = jwt.sign({
            workerId: user.id
        }, WORKER_JWT_SECRET)

        res.json({
            token,
            amount: 0
        })
    }
});


// nextTask
router.get("/nextTask", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "You're not logged in!" });
  }

  try {
    const task = await getNextTask(Number(userId));

    if (!task) {
      res.status(404).json({
        message: "No tasks available",
      });
    } else {
      res.status(200).json({
        id: task.id,
        title: task.title,
        amount: task.amount.toString(),
        expiresAt: task.expiresAt,
        options: task.options.map(opt => ({
          id: opt.id,
          imageUrl: opt.image_url
        })),
        totalSubmissions: task._count?.submissions || 0
      });
    }
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch next task",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// submission
router.post("/submission", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);

  if (!userId) {
    return res.status(401).json({ message: "You're not logged in!" });
  }

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid input",
      error: parsedBody.error.message,
    });
  }

  try {
    // Check if task exists and is available
    const task = await prismaClient.task.findFirst({
      where: {
        id: Number(parsedBody.data.taskId),
        done: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        options: true
      }
    });

    if (!task) {
      return res.status(400).json({
        message: "Task is no longer available"
      });
    }

    // Check if option exists
    const optionExists = task.options.some(opt => opt.id === Number(parsedBody.data.selection));
    if (!optionExists) {
      return res.status(400).json({
        message: "Invalid option selected"
      });
    }

    // Check for duplicate submission
    const existingSubmission = await prismaClient.submission.findFirst({
      where: {
        task_id: Number(parsedBody.data.taskId),
        worker_id: Number(userId)
      }
    });

    if (existingSubmission) {
      return res.status(403).json({
        message: "You have already submitted for this task"
      });
    }

    const amount = BigInt(task.amount) / BigInt(TOTAL_SUBMISSIONS);
    const submission = await prismaClient.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          option_id: Number(parsedBody.data.selection),
          task_id: Number(parsedBody.data.taskId),
          worker_id: Number(userId),
          amount: Number(amount),
        },
      });

      await tx.worker.update({
        where: {
          id: Number(userId),
        },
        data: {
          pending_amount: {
            increment: amount,
          },
        },
      });
      return submission;
    });

    const nextTask = await getNextTask(Number(userId));

    res.status(200).json({
      message: "Submission successful",
      submissionId: submission.id,
      nextTask,
      amount: amount.toString(),
    });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ 
      message: "Failed to submit response",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// get balance
router.get("/balance", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const worker = await prismaClient.worker.findFirst({
    where: {
      id: Number(userId),
    },
  });

  res.json({
    pendingAmount: worker?.pending_amount?.toString(),
    lockedAmount: worker?.locked_amount?.toString(),
  });
});

// Get worker submissions
router.get("/submissions", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  
  try {
    const submissions = await prismaClient.submission.findMany({
      where: {
        worker_id: Number(userId),
      },
      include: {
        task: {
          select: {
            title: true,
            amount: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    res.json({
      submissions: submissions.map(s => ({
        id: s.id,
        worker_id: s.worker_id,
        option_id: s.option_id,
        task_id: s.task_id,
        amount: s.amount.toString(), // Convert BigInt to string
        task_title: s.task?.title || `Task #${s.task_id}`,
        task_amount: s.task?.amount?.toString() || "0.1", // Convert BigInt to string
        created_at: s.task?.createdAt || new Date().toISOString() // Use task creation date
      }))
    });
  } catch (error: any) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({
      message: "Failed to fetch submissions",
      error: error.message
    });
  }
});

// Get worker payouts
router.get("/payouts", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  
  try {
    const payouts = await prismaClient.payouts.findMany({
      where: {
        worker_id: Number(userId),
      },
      orderBy: {
        id: 'desc'
      }
    });

    res.json({
      payouts: payouts.map(p => ({
        id: p.id,
        user_id: p.user_id,
        worker_id: p.worker_id,
        amount: p.amount.toString(), // Convert BigInt to string
        signature: p.signature,
        status: p.status,
        created_at: new Date().toISOString() // Use current date since payouts don't have timestamp
      }))
    });
  } catch (error: any) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({
      message: "Failed to fetch payouts",
      error: error.message
    });
  }
});

// Test endpoint without authentication for debugging
router.get("/test-earnings", async (req, res) => {
  const userId = 1; // Hardcoded worker ID for testing
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 4;
  const skip = (page - 1) * limit;
  
  try {
    // Fetch worker balance and transaction history
    const [worker, submissions, payouts, totalCount] = await Promise.all([
      prismaClient.worker.findFirst({
        where: { id: Number(userId) }
      }),
      // Fetch all submissions and payouts first, then apply pagination
      prismaClient.submission.findMany({
        where: {
          worker_id: Number(userId),
        },
        include: {
          task: {
            select: {
              title: true,
              amount: true,
              createdAt: true,
              expiresAt: true
            }
          }
        },
        orderBy: {
          id: 'desc'
        }
      }),
      prismaClient.payouts.findMany({
        where: {
          worker_id: Number(userId),
        },
        orderBy: {
          id: 'desc'
        }
      }),
      // Get total count for pagination
      prismaClient.submission.count({
        where: {
          worker_id: Number(userId),
        }
      }).then(count => 
        Promise.all([
          count,
          prismaClient.payouts.count({
            where: {
              worker_id: Number(userId),
            }
          })
        ]).then(([subCount, payoutCount]) => subCount + payoutCount)
      )
    ]);
    
    // Combine all records first
    const allEarnings = [
      ...submissions.map((s: any) => ({
        id: s.id,
        amount: s.amount.toString(), // Keep in lamports for frontend conversion
        date: s.task?.createdAt || new Date().toISOString(),
        status: 'pending' as const, // All submissions are pending until paid out
        taskId: s.task_id,
        taskTitle: s.task?.title || `Task #${s.task_id}`,
        transactionHash: undefined
      })),
      ...payouts.map((p: any) => ({
        id: p.id,
        amount: p.amount.toString(), // Keep in lamports for frontend conversion
        date: new Date().toISOString(), // Payouts don't have timestamp, use current
        status: 'withdrawn' as const,
        taskId: undefined,
        taskTitle: undefined,
        transactionHash: p.signature
      }))
    ].sort((a, b) => b.id - a.id);

    // Apply pagination to the combined results
    const earnings = allEarnings.slice(skip, skip + limit);

    // Calculate metrics
    const pendingEarnings = worker?.pending_amount?.toString() || "0";
    const totalEarned = payouts.reduce((sum, p) => sum + Number(p.amount), 0).toString();

    res.json({
      metrics: {
        pendingEarnings,
        totalEarned
      },
      earnings,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1
      }
    });
  } catch (error: any) {
    console.error("Error in test earnings endpoint:", error);
    res.status(500).json({
      message: "Failed to fetch earnings",
      error: error.message
    });
  }
});

// Get worker earnings - dedicated endpoint
router.get("/earnings", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 4;
  const skip = (page - 1) * limit;
  
  try {
    // Fetch worker balance and transaction history
    const [worker, submissions, payouts, totalCount] = await Promise.all([
      prismaClient.worker.findFirst({
        where: { id: Number(userId) }
      }),
      // Fetch all submissions and payouts first, then apply pagination
      prismaClient.submission.findMany({
        where: {
          worker_id: Number(userId),
        },
        include: {
          task: {
            select: {
              title: true,
              amount: true,
              createdAt: true,
              expiresAt: true
            }
          }
        },
        orderBy: {
          id: 'desc'
        }
      }),
      prismaClient.payouts.findMany({
        where: {
          worker_id: Number(userId),
        },
        orderBy: {
          id: 'desc'
        }
      }),
      // Get total count for pagination
      prismaClient.submission.count({
        where: {
          worker_id: Number(userId),
        }
      }).then(count => 
        Promise.all([
          count,
          prismaClient.payouts.count({
            where: {
              worker_id: Number(userId),
            }
          })
        ]).then(([subCount, payoutCount]) => subCount + payoutCount)
      )
    ]);
    // Combine all records first
    const allEarnings = [
      ...submissions.map((s: any) => ({
        id: s.id,
        amount: s.amount.toString(), // Keep in lamports for frontend conversion
        date: s.task?.createdAt || new Date().toISOString(),
        status: 'pending' as const, // All submissions are pending until paid out
        taskId: s.task_id,
        taskTitle: s.task?.title || `Task #${s.task_id}`,
        transactionHash: undefined
      })),
      ...payouts.map((p: any) => ({
        id: p.id,
        amount: p.amount.toString(), // Keep in lamports for frontend conversion
        date: new Date().toISOString(), // Payouts don't have timestamp, use current
        status: 'withdrawn' as const,
        taskId: undefined,
        taskTitle: undefined,
        transactionHash: p.signature
      }))
    ].sort((a, b) => b.id - a.id);

    // Apply pagination to the combined results
    const earnings = allEarnings.slice(skip, skip + limit);

    // Calculate metrics
    const pendingEarnings = worker?.pending_amount?.toString() || "0";
    const totalEarned = payouts.reduce((sum, p) => sum + Number(p.amount), 0).toString();

    res.json({
      metrics: {
        pendingEarnings,
        totalEarned
      },
      earnings,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1
      }
    });
  } catch (error: any) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({
      message: "Failed to fetch earnings",
      error: error.message
    });
  }
});

// Worker dashboard - single endpoint for all dashboard data
router.get("/dashboard", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  
  try {
    console.log("Worker dashboard for user:", userId);
    
    // Fetch all data in parallel
    const [worker, submissions, nextTask] = await Promise.all([
      prismaClient.worker.findFirst({
        where: { id: Number(userId) }
      }),
      prismaClient.submission.findMany({
        where: { worker_id: Number(userId) },
        include: {
          task: {
            select: {
              title: true,
              amount: true,
              expiresAt: true
            }
          }
        },
        orderBy: { id: 'desc' }
      }),
      getNextTask(Number(userId)).catch(() => null)
    ]);

    console.log("Next task found:", nextTask ? "YES" : "NO");
    if (nextTask) {
      console.log("Next task ID:", nextTask.id);
    }

    // Calculate metrics
    const completedTasks = submissions.length; // Count all submissions as completed tasks
    
    const availableTasks = nextTask ? 1 : 0;
    const pendingEarnings = worker?.pending_amount?.toString() || "0";
    const totalEarned = worker?.locked_amount?.toString() || "0";

    console.log("Dashboard metrics:", {
      availableTasks,
      completedTasks,
      pendingEarnings,
      totalEarned
    });

    // Format recent tasks for dashboard
    const recentTasks = submissions.slice(0, 5).map(s => ({
      id: s.task_id,
      title: s.task?.title || `Task #${s.task_id}`,
      amount: s.amount.toString(), // Already converted to string
      status: 'completed',
      createdAt: new Date().toISOString(),
      expiresAt: s.task?.expiresAt ? s.task.expiresAt.toISOString() : null
    }));

    res.json({
      metrics: {
        availableTasks,
        completedTasks,
        pendingEarnings,
        totalEarned
      },
      recentTasks,
      nextTask: nextTask ? {
        id: nextTask.id,
        title: nextTask.title,
        amount: nextTask.amount.toString(),
        expiresAt: nextTask.expiresAt,
        options: nextTask.options.map(opt => ({
          id: opt.id,
          imageUrl: opt.image_url
        }))
      } : null,
      submissions: submissions.map(s => ({
        id: s.id,
        worker_id: s.worker_id,
        option_id: s.option_id,
        task_id: s.task_id,
        amount: s.amount.toString(),
        task_title: s.task?.title || `Task #${s.task_id}`,
        task_amount: s.task?.amount?.toString() || "0.1"
      }))
    });
  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      message: "Failed to fetch dashboard data",
      error: error.message
    });
  }
});

// payout
router.post("/payout", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { signature: withdrawalSignature } = req.body;
  const worker = await prismaClient.worker.findFirst({
    where: {
      id: Number(userId),
    },
  });

  if (!worker) {
    return res.status(403).json({
      message: "User not found",
    });
  }

  if (!worker.pending_amount || Number(worker.pending_amount) <= 0) {
    return res.status(400).json({
      message: "No pending earnings to withdraw"
    });
  }

  // Verify user's signature for withdrawal confirmation
  if (!withdrawalSignature) {
    return res.status(400).json({
      message: "Withdrawal signature is required"
    });
  }

  const withdrawalMessage = new TextEncoder().encode(`Withdraw ${worker.pending_amount} lamports to ${worker.address}`);
  
  // Handle different signature formats
  let signatureBytes;
  if (withdrawalSignature.data) {
    signatureBytes = new Uint8Array(withdrawalSignature.data);
  } else if (Array.isArray(withdrawalSignature)) {
    signatureBytes = new Uint8Array(withdrawalSignature);
  } else if (typeof withdrawalSignature === 'string') {
    signatureBytes = Uint8Array.from(atob(withdrawalSignature), c => c.charCodeAt(0));
  } else {
    signatureBytes = new Uint8Array(withdrawalSignature);
  }

  const isSignatureValid = nacl.sign.detached.verify(
    withdrawalMessage,
    signatureBytes,
    new PublicKey(worker.address).toBytes(),
  );

  if (!isSignatureValid) {
    return res.status(401).json({
      message: "Invalid withdrawal signature"
    });
  }

  try {
    const lamportsToTransfer = Number((1000000000n * BigInt(worker.pending_amount)) / BigInt(TOTAL_DECIMALS));
    console.log("Transferring lamports:", lamportsToTransfer);
    console.log("Worker address:", worker.address);

    // Find the task that this worker submitted to get the creator's wallet
    const submission = await prismaClient.submission.findFirst({
      where: {
        worker_id: Number(userId),
      },
      include: {
        task: {
          include: {
            user: true
          }
        }
      }
    });

    if (!submission || !submission.task || !submission.task.user) {
      return res.status(400).json({
        message: "No task submission found to determine payment source"
      });
    }

    const creatorAddress = submission.task.user.address;
    console.log("Creator wallet address:", creatorAddress);
    
    // Get recent blockhash for transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Use the parent wallet address (where creators pay 0.1 SOL) for payouts
    const parentWalletPublicKey = new PublicKey(PARENT_WALLET_ADDRESS);
    console.log("Parent wallet address:", parentWalletPublicKey.toString());
    
    // Check parent wallet balance
    const balance = await connection.getBalance(parentWalletPublicKey);
    console.log("Parent wallet balance:", balance, "lamports");
    
    // Estimate transaction cost (typically ~5000 lamports for simple transfer)
    const estimatedFee = 5000;
    const totalNeeded = lamportsToTransfer + estimatedFee;
    
    if (balance < totalNeeded) {
      return res.status(500).json({
        message: `Parent wallet needs to be funded. Need ${totalNeeded} lamports, but only have ${balance} lamports (${(balance/1000000000).toFixed(9)} SOL). Please fund the parent wallet: ${PARENT_WALLET_ADDRESS}`,
        error: "Insufficient funds",
        balance: balance,
        needed: totalNeeded,
        parentWallet: PARENT_WALLET_ADDRESS
      });
    }

    // Create keypair from private key to sign the transaction
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    // Verify that the private key matches the parent wallet address
    if (keypair.publicKey.toString() !== PARENT_WALLET_ADDRESS) {
      return res.status(500).json({
        message: `Private key does not match parent wallet address. Private key generates address: ${keypair.publicKey.toString()}, but parent wallet is: ${PARENT_WALLET_ADDRESS}`,
        error: "Wallet configuration mismatch",
        generatedAddress: keypair.publicKey.toString(),
        parentAddress: PARENT_WALLET_ADDRESS
      });
    }
    
    const transaction = new Transaction({
      feePayer: parentWalletPublicKey,
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: parentWalletPublicKey,
        toPubkey: new PublicKey(worker.address),
        lamports: lamportsToTransfer,
      })
    );

    let signature = "";
    try {
      signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        {
          commitment: 'confirmed',
        }
      );
    } catch(e: any) {
      console.error("Transaction error:", e);
      let errorMessage = "Transaction failed";
      
      if (e.message?.includes('insufficient')) {
        errorMessage = "Insufficient funds in platform wallet";
      } else if (e.message?.includes('block height exceeded')) {
        errorMessage = "Transaction expired, please try again";
      } else if (e.message?.includes('network')) {
        errorMessage = "Network error, please try again";
      } else if (e.message?.includes('unknown signer')) {
        errorMessage = "Platform wallet configuration error";
      } else if (e.message?.includes('Attempt to debit')) {
        errorMessage = "Platform wallet has insufficient SOL balance";
      }
      
      return res.status(500).json({
        message: errorMessage,
        error: e.message
      });
    }
    
    console.log("Transaction signature:", signature);

    await prismaClient.$transaction(async (tx) => {
      await tx.worker.update({
        where: {
          id: Number(userId),
        },
        data: {
          pending_amount: {
            decrement: worker.pending_amount,
          },
          locked_amount: {
            increment: worker.pending_amount,
          },
        },
      });

      const txnId = signature;

      await tx.payouts.create({
        data: {
          worker_id: Number(userId),
          amount: worker.pending_amount,
          status: "Processing",
          signature: txnId,
        },
      });
    });

    res.json({
      message: "Withdrawal successful",
      signature: signature,
      amount: worker.pending_amount.toString()
    });

  } catch(e: any) {
    console.error("Payout error:", e);
    res.status(500).json({
      message: "Withdrawal failed",
      error: e.message
    });
  }
});

export default router;
