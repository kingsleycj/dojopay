import { TaskStatus } from "@prisma/client";
import { config, MAX_SUBMISSIONS_PER_TASK, TASK_PRICE_LAMPORTS } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { toCdnUrl } from "../lib/s3.js";
import { getConnection } from "../lib/solana.js";
import { logger } from "../lib/logger.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import type { CreateTaskInput, UpdateTaskInput } from "../types/types.js";

/**
 * Task lifecycle: funding verification, creation, reads, and closure.
 */

async function fetchFundingTransaction(signature: string) {
  const connection = getConnection();
  const { txLookupAttempts, txLookupBaseDelayMs } = config.solana;

  for (let attempt = 0; attempt <= txLookupAttempts; attempt++) {
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (transaction) return transaction;

    // Confirmed transactions take a moment to become queryable by signature.
    if (attempt < txLookupAttempts && txLookupBaseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * txLookupBaseDelayMs));
    }
  }
  return null;
}

/**
 * Confirm on chain that `signature` moved exactly the task price from the
 * creator's wallet into the platform wallet.
 *
 * Checks, in order: the transaction exists, it succeeded, the platform wallet
 * gained exactly the task price, and the payer is the signed-in creator. The
 * old version skipped the `meta.err` check entirely, so a *failed* transaction
 * whose balances happened to line up could fund a task.
 */
export async function verifyFundingTransaction(signature: string, creatorAddress: string): Promise<void> {
  const existing = await prismaClient.task.findUnique({ where: { signature } });
  if (existing) {
    throw conflict("This transaction has already funded a task", "SIGNATURE_ALREADY_USED");
  }

  const transaction = await fetchFundingTransaction(signature);
  if (!transaction) {
    throw badRequest("Transaction not found on chain", "TX_NOT_FOUND");
  }

  if (transaction.meta?.err) {
    throw badRequest("Funding transaction failed on chain", "TX_FAILED");
  }

  const accountKeys = transaction.transaction.message.getAccountKeys();
  const platformAddress = config.solana.platformWalletAddress;

  let platformIndex = -1;
  for (let i = 0; i < accountKeys.length; i++) {
    if (accountKeys.get(i)?.toString() === platformAddress) {
      platformIndex = i;
      break;
    }
  }

  if (platformIndex === -1) {
    throw badRequest("Transaction does not pay the platform wallet", "WRONG_RECIPIENT");
  }

  const preBalances = transaction.meta?.preBalances ?? [];
  const postBalances = transaction.meta?.postBalances ?? [];
  const credited = (postBalances[platformIndex] ?? 0) - (preBalances[platformIndex] ?? 0);

  if (credited !== TASK_PRICE_LAMPORTS) {
    throw badRequest(
      `Expected a transfer of ${TASK_PRICE_LAMPORTS} lamports, saw ${credited}`,
      "WRONG_AMOUNT",
      { expected: TASK_PRICE_LAMPORTS, received: credited },
    );
  }

  // Account key 0 is the fee payer, i.e. whoever actually sent the SOL.
  if (accountKeys.get(0)?.toString() !== creatorAddress) {
    throw badRequest("Funding transaction was not sent by your wallet", "WRONG_PAYER");
  }
}

function parseExpiry(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("Invalid expiration date", "INVALID_EXPIRY");
  }
  if (date.getTime() <= Date.now()) {
    throw badRequest("Expiration date must be in the future", "EXPIRY_IN_PAST");
  }
  return date;
}

export async function createTask(userId: number, input: CreateTaskInput) {
  const user = await prismaClient.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Creator account not found", "USER_NOT_FOUND");

  await verifyFundingTransaction(input.signature, user.address);

  const expiresAt = parseExpiry(input.expirationDate);

  // Task and options are created together: a task with no options is unusable
  // and the old code could leave one behind if the option insert failed.
  return prismaClient.task.create({
    data: {
      title: input.title ?? "Select your preferred choice",
      amount: BigInt(TASK_PRICE_LAMPORTS),
      signature: input.signature,
      user_id: userId,
      expiresAt,
      options: {
        create: input.options.map((option) => ({ image_url: option.imageUrl })),
      },
    },
    include: { options: true },
  });
}

/** Derived status — a task can be past its expiry without a writer having noticed. */
export function effectiveStatus(task: {
  status: TaskStatus;
  expiresAt: Date | null;
}): TaskStatus {
  if (task.status === TaskStatus.OPEN && task.expiresAt && task.expiresAt <= new Date()) {
    return TaskStatus.EXPIRED;
  }
  return task.status;
}

export async function listCreatorTasks(userId: number) {
  const tasks = await prismaClient.task.findMany({
    where: { user_id: userId },
    include: { options: true },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    amount: task.amount.toString(),
    status: effectiveStatus(task),
    totalSubmissions: task.submissionCount,
    maxSubmissions: MAX_SUBMISSIONS_PER_TASK,
    // Real creation time. The old endpoint returned `new Date()` here, so every
    // task appeared to have been created the moment it was fetched.
    createdAt: task.createdAt.toISOString(),
    expiresAt: task.expiresAt?.toISOString() ?? null,
    options: task.options.map((option) => ({
      id: option.id,
      imageUrl: toCdnUrl(option.image_url),
    })),
  }));
}

export async function getCreatorTask(userId: number, taskId: number) {
  const task = await prismaClient.task.findFirst({
    where: { id: taskId, user_id: userId },
    include: { options: true },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");
  return task;
}

/** Task detail with per-option vote counts, for the creator's results view. */
export async function getTaskResults(userId: number, taskId: number) {
  const task = await getCreatorTask(userId, taskId);

  const submissions = await prismaClient.submission.findMany({
    where: { task_id: taskId },
    include: { worker: true },
    orderBy: { createdAt: "desc" },
  });

  const counts = new Map<number, number>();
  for (const submission of submissions) {
    counts.set(submission.option_id, (counts.get(submission.option_id) ?? 0) + 1);
  }

  const result: Record<string, { count: number; option: { imageUrl: string } }> = {};
  for (const option of task.options) {
    result[option.id] = {
      count: counts.get(option.id) ?? 0,
      option: { imageUrl: toCdnUrl(option.image_url) },
    };
  }

  return {
    result,
    taskDetails: {
      id: task.id,
      title: task.title,
      status: effectiveStatus(task),
      amount: task.amount.toString(),
      totalSubmissions: task.submissionCount,
      maxSubmissions: MAX_SUBMISSIONS_PER_TASK,
      createdAt: task.createdAt.toISOString(),
      expiresAt: task.expiresAt?.toISOString() ?? null,
    },
    submissions: submissions.map((submission) => ({
      workerId: submission.worker_id,
      workerAddress: submission.worker.address,
      optionId: submission.option_id,
      amount: submission.amount.toString(),
      submittedAt: submission.createdAt.toISOString(),
    })),
  };
}

export async function updateTask(userId: number, taskId: number, input: UpdateTaskInput) {
  const task = await prismaClient.task.findFirst({
    where: { id: taskId, user_id: userId },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");
  if (task.status !== TaskStatus.OPEN) {
    throw badRequest("Only open tasks can be edited", "TASK_NOT_EDITABLE");
  }

  const expiresAt = input.expirationDate === undefined ? undefined : parseExpiry(input.expirationDate);

  return prismaClient.task.update({
    where: { id: taskId },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(expiresAt === undefined ? {} : { expiresAt }),
    },
  });
}

/**
 * Public, unauthenticated view used by share links. Deliberately narrow: no
 * worker addresses, no creator identity, no submission detail.
 */
export async function getPublicTask(taskId: number) {
  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    include: { options: { take: 4 } },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");

  const status = effectiveStatus(task);
  const rewardPerSubmission = task.amount / BigInt(MAX_SUBMISSIONS_PER_TASK);

  return {
    id: task.id,
    title: task.title,
    status,
    isOpen: status === TaskStatus.OPEN,
    rewardLamports: rewardPerSubmission.toString(),
    totalSubmissions: task.submissionCount,
    maxSubmissions: MAX_SUBMISSIONS_PER_TASK,
    spotsRemaining: Math.max(0, MAX_SUBMISSIONS_PER_TASK - task.submissionCount),
    expiresAt: task.expiresAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    previewImages: task.options.map((option) => toCdnUrl(option.image_url)),
  };
}

/**
 * Sweep tasks whose expiry has passed into EXPIRED. Cheap to run and keeps
 * `nextTask` honest without every read having to reason about wall-clock time.
 */
export async function expireStaleTasks(): Promise<number> {
  const { count } = await prismaClient.task.updateMany({
    where: { status: TaskStatus.OPEN, expiresAt: { lte: new Date() } },
    data: { status: TaskStatus.EXPIRED },
  });

  if (count > 0) logger.info("Expired stale tasks", { count });
  return count;
}
