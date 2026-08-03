import { Prisma, TaskStatus } from "@prisma/client";
import { prismaClient } from "../lib/prisma.js";
import { toCdnUrl } from "../lib/storage.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { AuditAction, auditAccount, auditSystem, type AuditContext } from "./audit.service.js";
import { releaseReward } from "./vault.service.js";

/**
 * Worker-side task discovery and submission.
 */

/**
 * Tasks this worker can still do: open, not expired, not already answered by
 * them, and not yet at capacity.
 *
 * The capacity clause is the fix for the drain bug — previously any number of
 * workers could submit to a task funded for only 100 of them. It compares
 * against each task's own `maxSubmissions` now that creators set it per task,
 * which Prisma cannot express as a column-to-column filter, so the bound is
 * applied after the read.
 */
function availableTaskFilter(workerId: number): Prisma.TaskWhereInput {
  return {
    status: TaskStatus.OPEN,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    submissions: { none: { worker_id: workerId } },
  };
}

function serializeWorkerTask(task: {
  id: number;
  title: string;
  amount: bigint;
  rewardPerSubmission: bigint;
  maxSubmissions: number;
  submissionCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  options: Array<{ id: number; image_url: string }>;
}) {
  return {
    id: task.id,
    title: task.title,
    amount: task.amount.toString(),
    rewardLamports: task.rewardPerSubmission.toString(),
    expiresAt: task.expiresAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    totalSubmissions: task.submissionCount,
    maxSubmissions: task.maxSubmissions,
    spotsRemaining: Math.max(0, task.maxSubmissions - task.submissionCount),
    options: task.options.map((option) => ({
      id: option.id,
      imageUrl: toCdnUrl(option.image_url),
    })),
  };
}

export async function getNextTask(workerId: number) {
  // Read a small window and pick the first with capacity, rather than one row
  // that might already be full. Cheap because `submissionCount >= max` is rare.
  const candidates = await prismaClient.task.findMany({
    where: availableTaskFilter(workerId),
    orderBy: { createdAt: "asc" },
    include: { options: true },
    take: 25,
  });

  const task = candidates.find((candidate) => candidate.submissionCount < candidate.maxSubmissions);
  return task ? serializeWorkerTask(task) : null;
}

/**
 * Every task this worker could take on, best-paying first.
 *
 * Workers used to be handed one task at a time with no way to see what else was
 * there — fine when every task paid the same 0.001 SOL, misleading now that
 * creators set their own rewards and one queue position can be worth ten times
 * another.
 */
export async function listAvailableTasks(workerId: number, limit = 50) {
  const candidates = await prismaClient.task.findMany({
    where: availableTaskFilter(workerId),
    orderBy: [{ rewardPerSubmission: "desc" }, { createdAt: "asc" }],
    include: { options: true },
    take: limit * 2,
  });

  return candidates
    .filter((task) => task.submissionCount < task.maxSubmissions)
    .slice(0, limit)
    .map(serializeWorkerTask);
}

/**
 * Record a worker's answer, credit their pending balance, and consume the
 * matching slice of the creator's vault reservation.
 *
 * Everything happens in one transaction, and the capacity check uses a
 * conditional `updateMany` rather than a read-then-write: two workers racing for
 * the last slot both saw `count < max` under the old code and both got paid.
 * Here the second one's update matches zero rows and the transaction aborts.
 *
 * The vault leg is new and it is the point of the whole exercise. A worker being
 * credited and a creator's committed funds being drawn down are now one atomic
 * event, so "what workers are owed" and "what creators have committed" cannot
 * drift apart.
 */
export async function submitTask(
  workerId: number,
  taskId: number,
  optionId: number,
  context?: AuditContext,
) {
  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    include: {
      options: { select: { id: true } },
      user: { select: { account: { select: { id: true, vault: { select: { id: true } } } } } },
    },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");

  if (task.status !== TaskStatus.OPEN) {
    throw badRequest("This task is no longer accepting submissions", "TASK_CLOSED");
  }

  if (task.expiresAt && task.expiresAt <= new Date()) {
    throw badRequest("This task has expired", "TASK_EXPIRED");
  }

  if (task.submissionCount >= task.maxSubmissions) {
    throw badRequest("This task is already full", "TASK_FULL");
  }

  if (!task.options.some((option) => option.id === optionId)) {
    throw badRequest("That option does not belong to this task", "INVALID_OPTION");
  }

  const reward = task.rewardPerSubmission;
  const creatorVaultId = task.user.account.vault?.id ?? null;

  const worker = await prismaClient.worker.findUnique({
    where: { id: workerId },
    select: { account_id: true },
  });

  try {
    const outcome = await prismaClient.$transaction(async (tx) => {
      // Atomic claim on one of the remaining slots.
      const claimed = await tx.task.updateMany({
        where: {
          id: taskId,
          status: TaskStatus.OPEN,
          submissionCount: { lt: task.maxSubmissions },
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

      // Draw the reward out of the creator's reservation. Skipped for tasks
      // created before vaults existed: they have no reservation to draw from,
      // and inventing one would make a creator's balance go negative.
      if (task.vaultFunded && creatorVaultId) {
        await releaseReward(tx, creatorVaultId, reward, {
          taskId,
          description: `Submission reward — ${task.title}`,
        });
      }

      // Close the task once the slot we just took was the last one.
      const updated = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { submissionCount: true },
      });

      const taskFull = updated.submissionCount >= task.maxSubmissions;

      if (taskFull) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.COMPLETED, done: true },
        });
      }

      return { submission, reward, taskFull };
    });

    await auditAccount(worker?.account_id, AuditAction.SUBMISSION_CREATED, {
      entityType: "task",
      entityId: taskId,
      metadata: {
        submissionId: outcome.submission.id,
        optionId,
        rewardLamports: outcome.reward.toString(),
      },
      context,
    });

    if (outcome.taskFull) {
      await auditSystem(AuditAction.TASK_COMPLETED, {
        entityType: "task",
        entityId: taskId,
        metadata: { filledBySubmissionId: outcome.submission.id },
      });
    }

    return outcome;
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
  const [worker, submissions, available, completedTasks] = await Promise.all([
    prismaClient.worker.findUnique({ where: { id: workerId } }),
    prismaClient.submission.findMany({
      where: { worker_id: workerId },
      include: { task: { select: { title: true, amount: true, expiresAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    listAvailableTasks(workerId, 50),
    prismaClient.submission.count({ where: { worker_id: workerId } }),
  ]);

  if (!worker) throw notFound("Worker not found", "WORKER_NOT_FOUND");

  // Real numbers rather than the previous `nextTask ? 1 : 0`, which reported
  // "1 available task" whether there was one waiting or four hundred.
  const availableValue = available.reduce((sum, task) => sum + BigInt(task.rewardLamports), 0n);

  return {
    metrics: {
      availableTasks: available.length,
      /** What this worker could earn by clearing the whole queue. */
      availableValue: availableValue.toString(),
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
    /** Best-paying task first, so the highest-value work is the default next. */
    nextTask: available[0] ?? null,
    queue: available.slice(0, 8),
  };
}
