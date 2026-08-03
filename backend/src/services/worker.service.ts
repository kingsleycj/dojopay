import { Prisma, TaskStatus } from "@prisma/client";
import { MAX_SUBMISSIONS_PER_TASK } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { toCdnUrl } from "../lib/s3.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";

/**
 * Worker-side task discovery and submission.
 */

/**
 * The next task this worker can do: open, not expired, not already answered by
 * them, and not yet at capacity.
 *
 * The capacity clause is the fix for the drain bug — previously any number of
 * workers could submit to a task funded for only 100 of them.
 */
export async function getNextTask(workerId: number) {
  const task = await prismaClient.task.findFirst({
    where: {
      status: TaskStatus.OPEN,
      submissionCount: { lt: MAX_SUBMISSIONS_PER_TASK },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      submissions: { none: { worker_id: workerId } },
    },
    orderBy: { createdAt: "asc" },
    include: { options: true },
  });

  if (!task) return null;

  return {
    id: task.id,
    title: task.title,
    amount: task.amount.toString(),
    rewardLamports: (task.amount / BigInt(MAX_SUBMISSIONS_PER_TASK)).toString(),
    expiresAt: task.expiresAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    totalSubmissions: task.submissionCount,
    maxSubmissions: MAX_SUBMISSIONS_PER_TASK,
    options: task.options.map((option) => ({
      id: option.id,
      imageUrl: toCdnUrl(option.image_url),
    })),
  };
}

/**
 * Record a worker's answer and credit their pending balance.
 *
 * Everything happens in one transaction, and the capacity check uses a
 * conditional `updateMany` rather than a read-then-write: two workers racing for
 * the last slot both saw `count < 100` under the old code and both got paid.
 * Here the second one's update matches zero rows and the transaction aborts.
 */
export async function submitTask(workerId: number, taskId: number, optionId: number) {
  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    include: { options: { select: { id: true } } },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");

  if (task.status !== TaskStatus.OPEN) {
    throw badRequest("This task is no longer accepting submissions", "TASK_CLOSED");
  }

  if (task.expiresAt && task.expiresAt <= new Date()) {
    throw badRequest("This task has expired", "TASK_EXPIRED");
  }

  if (task.submissionCount >= MAX_SUBMISSIONS_PER_TASK) {
    throw badRequest("This task is already full", "TASK_FULL");
  }

  if (!task.options.some((option) => option.id === optionId)) {
    throw badRequest("That option does not belong to this task", "INVALID_OPTION");
  }

  const reward = task.amount / BigInt(MAX_SUBMISSIONS_PER_TASK);

  try {
    return await prismaClient.$transaction(async (tx) => {
      // Atomic claim on one of the remaining slots.
      const claimed = await tx.task.updateMany({
        where: {
          id: taskId,
          status: TaskStatus.OPEN,
          submissionCount: { lt: MAX_SUBMISSIONS_PER_TASK },
        },
        data: { submissionCount: { increment: 1 } },
      });

      if (claimed.count === 0) {
        throw badRequest("This task is already full", "TASK_FULL");
      }

      const submission = await tx.submission.create({
        data: {
          worker_id: workerId,
          task_id: taskId,
          option_id: optionId,
          amount: reward,
        },
      });

      await tx.worker.update({
        where: { id: workerId },
        data: { pending_amount: { increment: reward } },
      });

      // Close the task once the slot we just took was the last one.
      const updated = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { submissionCount: true },
      });

      if (updated.submissionCount >= MAX_SUBMISSIONS_PER_TASK) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.COMPLETED, done: true },
        });
      }

      return { submission, reward, taskFull: updated.submissionCount >= MAX_SUBMISSIONS_PER_TASK };
    });
  } catch (error) {
    // Unique [worker_id, task_id] — this worker already answered this task.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("You have already submitted for this task", "DUPLICATE_SUBMISSION");
    }
    throw error;
  }
}

export async function getWorkerBalance(workerId: number) {
  const worker = await prismaClient.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw notFound("Worker not found", "WORKER_NOT_FOUND");

  return {
    pendingAmount: worker.pending_amount.toString(),
    withdrawnAmount: worker.withdrawn_amount.toString(),
    // Legacy field name still read by older clients.
    lockedAmount: worker.withdrawn_amount.toString(),
  };
}

export async function listWorkerSubmissions(workerId: number) {
  const submissions = await prismaClient.submission.findMany({
    where: { worker_id: workerId },
    include: { task: { select: { title: true, amount: true, createdAt: true, expiresAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map((submission) => ({
    id: submission.id,
    worker_id: submission.worker_id,
    option_id: submission.option_id,
    task_id: submission.task_id,
    amount: submission.amount.toString(),
    task_title: submission.task.title,
    task_amount: submission.task.amount.toString(),
    // Real submission time, not `new Date()` at read time.
    created_at: submission.createdAt.toISOString(),
  }));
}

/** Paginated ledger combining submissions (earned) and payouts (withdrawn). */
export async function getWorkerEarnings(workerId: number, page: number, limit: number) {
  const [worker, submissions, payouts] = await Promise.all([
    prismaClient.worker.findUnique({ where: { id: workerId } }),
    prismaClient.submission.findMany({
      where: { worker_id: workerId },
      include: { task: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prismaClient.payouts.findMany({
      where: { worker_id: workerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!worker) throw notFound("Worker not found", "WORKER_NOT_FOUND");

  const ledger = [
    ...submissions.map((submission) => ({
      id: `submission-${submission.id}`,
      amount: submission.amount.toString(),
      date: submission.createdAt.toISOString(),
      status: "pending" as const,
      taskId: submission.task_id,
      taskTitle: submission.task.title,
      transactionHash: undefined as string | undefined,
    })),
    ...payouts.map((payout) => ({
      id: `payout-${payout.id}`,
      amount: payout.amount.toString(),
      date: payout.createdAt.toISOString(),
      status: "withdrawn" as const,
      taskId: undefined,
      taskTitle: undefined,
      transactionHash: payout.signature,
    })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const totalItems = ledger.length;
  const skip = (page - 1) * limit;

  // Only confirmed payouts count as earned — the old code summed every payout
  // regardless of status, so a failed withdrawal still showed as income.
  const totalEarned = payouts
    .filter((payout) => payout.status === "SUCCESS")
    .reduce((sum, payout) => sum + payout.amount, 0n);

  return {
    metrics: {
      pendingEarnings: worker.pending_amount.toString(),
      totalEarned: totalEarned.toString(),
      totalWithdrawn: worker.withdrawn_amount.toString(),
    },
    earnings: ledger.slice(skip, skip + limit),
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: skip + limit < totalItems,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getWorkerDashboard(workerId: number) {
  const [worker, submissions, nextTask] = await Promise.all([
    prismaClient.worker.findUnique({ where: { id: workerId } }),
    prismaClient.submission.findMany({
      where: { worker_id: workerId },
      include: { task: { select: { title: true, amount: true, expiresAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getNextTask(workerId),
  ]);

  if (!worker) throw notFound("Worker not found", "WORKER_NOT_FOUND");

  const completedTasks = await prismaClient.submission.count({ where: { worker_id: workerId } });

  return {
    metrics: {
      availableTasks: nextTask ? 1 : 0,
      completedTasks,
      pendingEarnings: worker.pending_amount.toString(),
      totalEarned: worker.withdrawn_amount.toString(),
    },
    recentTasks: submissions.map((submission) => ({
      id: submission.task_id,
      title: submission.task.title,
      amount: submission.amount.toString(),
      status: "completed" as const,
      createdAt: submission.createdAt.toISOString(),
      expiresAt: submission.task.expiresAt?.toISOString() ?? null,
    })),
    nextTask,
  };
}
