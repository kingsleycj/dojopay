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
import { privateKey } from "../privateKey";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
const connection = new Connection(process.env.RPC_URL ?? "");
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

    const existingUser = await prismaClient.worker.findFirst({
        where: {
            address: publicKey
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, WORKER_JWT_SECRET)

        res.json({
            token,
            amount: existingUser.pending_amount / TOTAL_DECIMALS
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
            userId: user.id
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
    return res.status(401).json({ message: "Unauthorized" });
  }

  const task = await getNextTask(Number(userId));

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

// submission
router.post("/submission", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);

  if (parsedBody.success) {
    const task = await getNextTask(Number(userId));
    if (!task || task?.id !== Number(parsedBody.data.taskId)) {
      return res.status(400).json({
        message: "Invalid task id",
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

    res.json({
      nextTask,
      amount: amount.toString(),
      message: "Submission received",
    });
  } else {
    return res.status(400).json({
      message: "Invalid input",
      error: parsedBody.error.message,
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

// payout
router.post("/payout", workerAuthMiddleware, async (req, res) => {
  const userId = req.userId;
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
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey("2KeovpYvrgpziaDsq8nbNMP4mc48VNBVXb5arbqrg9Cq"),
            toPubkey: new PublicKey(worker.address),
            lamports: 1000_000_000 * worker.pending_amount / TOTAL_DECIMALS,
        })
    );


    console.log(worker.address);

    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

    // TODO: There's a double spending problem here
    // The user can request the withdrawal multiple times
    // Can u figure out a way to fix it?
    let signature = "";
    try {
        signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair],
        );
    
     } catch(e) {
        return res.json({
            message: "Transaction failed"
        })
     }
    
    console.log(signature)

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
    message: "Processing Payout",
    amount: worker.pending_amount.toString()
  });
});

export default router;
