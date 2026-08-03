import { TaskStatus } from "@prisma/client";
import {
  MAX_SUBMISSIONS_PER_TASK,
  MAX_TASK_BUDGET_LAMPORTS,
  MIN_REWARD_PER_SUBMISSION_LAMPORTS,
  MIN_SUBMISSIONS_PER_TASK,
  MIN_TASK_BUDGET_LAMPORTS,
} from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { toCdnUrl } from "../lib/storage.js";
import { logger } from "../lib/logger.js";
import { badRequest, notFound } from "../utils/errors.js";
import type { CreateTaskInput, UpdateTaskInput } from "../types/types.js";
import { AuditAction, auditAccount, auditSystem, type AuditContext } from "./audit.service.js";
import { ensureVault, refundTaskRemainder, reserveForTask, serializeVault } from "./vault.service.js";

/**
 * Task lifecycle: funding from the creator's vault, creation, reads, closure,
 * and returning unspent budget.
 */

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

export interface TaskBudget {
  /** What the creator asked to commit. */
  requested: bigint;
  /** What each accepted submission pays. */
  rewardPerSubmission: bigint;
  /** How many submissions the task accepts. */
  maxSubmissions: number;
  /** `rewardPerSubmission * maxSubmissions` — what is actually reserved. */
  committed: bigint;
  /** `requested - committed`: indivisible remainder, left in the vault. */
  remainder: bigint;
}

/**
 * Turn a creator's "spend this much across this many answers" into exact
 * lamport arithmetic.
 *
 * The reward is floored, and the task reserves `reward * slots` rather than the
 * requested budget. That difference matters: reserving the full request would
 * leave up to `slots - 1` lamports permanently stranded in a task that can never
 * spend them. Leaving the remainder in the vault instead keeps the invariant
 * `reserved == what workers can still claim` exactly true, which is what makes
 * refunds a subtraction rather than a reconciliation.
 */
export function planBudget(requested: bigint, maxSubmissions: number): TaskBudget {
  if (requested < MIN_TASK_BUDGET_LAMPORTS) {
    throw badRequest(
      `A task needs a budget of at least ${MIN_TASK_BUDGET_LAMPORTS} lamports`,
      "BUDGET_TOO_SMALL",
      { minimum: MIN_TASK_BUDGET_LAMPORTS.toString(), requested: requested.toString() },
    );
  }
  if (requested > MAX_TASK_BUDGET_LAMPORTS) {
    throw badRequest(
      `A single task may commit at most ${MAX_TASK_BUDGET_LAMPORTS} lamports`,
      "BUDGET_TOO_LARGE",
      { maximum: MAX_TASK_BUDGET_LAMPORTS.toString(), requested: requested.toString() },
    );
  }
  if (maxSubmissions < MIN_SUBMISSIONS_PER_TASK || maxSubmissions > MAX_SUBMISSIONS_PER_TASK) {
    throw badRequest(
      `A task must accept between ${MIN_SUBMISSIONS_PER_TASK} and ${MAX_SUBMISSIONS_PER_TASK} submissions`,
      "INVALID_SUBMISSION_COUNT",
      { minimum: MIN_SUBMISSIONS_PER_TASK, maximum: MAX_SUBMISSIONS_PER_TASK },
    );
  }

  const rewardPerSubmission = requested / BigInt(maxSubmissions);

  if (rewardPerSubmission < MIN_REWARD_PER_SUBMISSION_LAMPORTS) {
    throw badRequest(
      `That budget spread over ${maxSubmissions} submissions pays ${rewardPerSubmission} lamports each, ` +
        `below the ${MIN_REWARD_PER_SUBMISSION_LAMPORTS} minimum. Raise the budget or ask for fewer answers.`,
      "REWARD_TOO_SMALL",
      {
        minimum: MIN_REWARD_PER_SUBMISSION_LAMPORTS.toString(),
        rewardPerSubmission: rewardPerSubmission.toString(),
      },
    );
  }

  const committed = rewardPerSubmission * BigInt(maxSubmissions);

  return {
    requested,
    rewardPerSubmission,
    maxSubmissions,
    committed,
    remainder: requested - committed,
  };
}

/**
 * Preview the arithmetic without committing anything.
 *
 * The composer calls this as the creator moves the sliders, so the numbers on
 * screen are the numbers the server will use — rather than the frontend
 * reimplementing the rounding and the two disagreeing at the last step.
 */
export function quoteBudget(requested: bigint, maxSubmissions: number) {
  const plan = planBudget(requested, maxSubmissions);
  return {
    budget: plan.requested.toString(),
    committed: plan.committed.toString(),
    remainder: plan.remainder.toString(),
    rewardPerSubmission: plan.rewardPerSubmission.toString(),
    maxSubmissions: plan.maxSubmissions,
  };
}

export async function createTask(
  userId: number,
  input: CreateTaskInput,
  context?: AuditContext,
) {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { id: true, account_id: true },
  });
  if (!user) throw notFound("Creator profile not found", "USER_NOT_FOUND");

  const plan = planBudget(BigInt(input.budgetLamports), input.maxSubmissions);
  const expiresAt = parseExpiry(input.expirationDate);
  const vault = await ensureVault(user.account_id, context);
  const title = input.title ?? "Select your preferred choice";

  /**
   * One transaction covers the reservation, the task, and its options.
   *
   * Nothing here can half-happen: no task exists without its funding reserved,
   * no funding is taken for a task that failed to create, and a task can never
   * be left with no options — which the previous two-step version could do.
   */
  const task = await prismaClient.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        amount: plan.committed,
        rewardPerSubmission: plan.rewardPerSubmission,
        maxSubmissions: plan.maxSubmissions,
        vaultFunded: true,
        user_id: userId,
        expiresAt,
        options: {
          create: input.options.map((option) => ({ image_url: option.imageUrl })),
        },
      },
      include: { options: true },
    });

    await reserveForTask(tx, vault.id, plan.committed, {
      taskId: created.id,
      description: `Task funded — ${title}`,
    });

    return created;
  });

  await auditAccount(user.account_id, AuditAction.TASK_CREATED, {
    entityType: "task",
    entityId: task.id,
    metadata: {
      title: task.title,
      amountLamports: task.amount.toString(),
      rewardPerSubmission: task.rewardPerSubmission.toString(),
      maxSubmissions: task.maxSubmissions,
      optionCount: task.options.length,
      fundedFrom: "vault",
    },
    context,
  });

  await auditAccount(user.account_id, AuditAction.VAULT_TASK_FUNDED, {
    entityType: "vault",
    entityId: vault.id,
    metadata: { taskId: task.id, amountLamports: plan.committed.toString() },
    context,
  });

  logger.info("Task created", {
    taskId: task.id,
    budget: plan.committed.toString(),
    slots: plan.maxSubmissions,
  });

  return task;
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
    rewardPerSubmission: task.rewardPerSubmission.toString(),
    status: effectiveStatus(task),
    totalSubmissions: task.submissionCount,
    maxSubmissions: task.maxSubmissions,
    spotsRemaining: Math.max(0, task.maxSubmissions - task.submissionCount),
    /** Still committed to workers who have not answered yet. */
    reservedRemaining: (
      BigInt(Math.max(0, task.maxSubmissions - task.submissionCount)) * task.rewardPerSubmission -
      task.refundedAmount
    ).toString(),
    spent: (BigInt(task.submissionCount) * task.rewardPerSubmission).toString(),
    refundedAmount: task.refundedAmount.toString(),
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
    include: {
      worker: { include: { account: { select: { walletAddress: true, displayName: true } } } },
    },
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
      rewardPerSubmission: task.rewardPerSubmission.toString(),
      totalSubmissions: task.submissionCount,
      maxSubmissions: task.maxSubmissions,
      spotsRemaining: Math.max(0, task.maxSubmissions - task.submissionCount),
      spent: (BigInt(task.submissionCount) * task.rewardPerSubmission).toString(),
      refundedAmount: task.refundedAmount.toString(),
      vaultFunded: task.vaultFunded,
      createdAt: task.createdAt.toISOString(),
      expiresAt: task.expiresAt?.toISOString() ?? null,
    },
    submissions: submissions.map((submission) => ({
      workerId: submission.worker_id,
      workerAddress: submission.worker.account.walletAddress ?? `Worker #${submission.worker_id}`,
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

  return {
    id: task.id,
    title: task.title,
    status,
    isOpen: status === TaskStatus.OPEN,
    rewardLamports: task.rewardPerSubmission.toString(),
    totalSubmissions: task.submissionCount,
    maxSubmissions: task.maxSubmissions,
    spotsRemaining: Math.max(0, task.maxSubmissions - task.submissionCount),
    expiresAt: task.expiresAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    previewImages: task.options.map((option) => toCdnUrl(option.image_url)),
  };
}

/**
 * Close a task early and return its unfilled slots to the creator's vault.
 *
 * The other half of letting creators choose a budget: committing 5 SOL to a
 * question nobody is answering has to be reversible, or the choice is a trap.
 * Submissions already accepted are untouched — that work was done and is owed.
 */
export async function cancelTask(userId: number, taskId: number, context?: AuditContext) {
  const task = await prismaClient.task.findFirst({
    where: { id: taskId, user_id: userId },
    include: { user: { select: { account_id: true } } },
  });

  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");
  if (task.status !== TaskStatus.OPEN) {
    throw badRequest("This task is already closed", "TASK_NOT_OPEN");
  }

  const refunded = await prismaClient.$transaction(async (tx) => {
    // Conditional on still being OPEN so a submission landing at the same
    // moment cannot be paid out of a reservation this call already released.
    const closed = await tx.task.updateMany({
      where: { id: taskId, status: TaskStatus.OPEN },
      data: { status: TaskStatus.REFUNDED, done: true },
    });
    if (closed.count === 0) {
      throw badRequest("This task is already closed", "TASK_NOT_OPEN");
    }

    const current = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
    return refundTaskRemainder(tx, current);
  });

  await auditAccount(task.user.account_id, AuditAction.TASK_CANCELLED, {
    entityType: "task",
    entityId: taskId,
    metadata: {
      refundedLamports: refunded.toString(),
      submissionsKept: task.submissionCount,
    },
    context,
  });

  const vault = await ensureVault(task.user.account_id);

  logger.info("Task cancelled", { taskId, refunded: refunded.toString() });

  return {
    message:
      refunded > 0n
        ? "Task closed. Unused budget is back in your vault."
        : "Task closed. It had no unused budget to return.",
    refunded: refunded.toString(),
    vault: serializeVault(vault),
  };
}

/**
 * Sweep tasks whose expiry has passed into EXPIRED, returning each one's
 * unfilled slots to its creator's vault.
 *
 * Before vaults this was a pure status update and the money simply stayed on the
 * platform. Refunding one task per transaction is deliberate: a single creator's
 * missing vault should not abort the sweep for everyone else's tasks.
 */
export async function expireStaleTasks(): Promise<{ expired: number; refunded: bigint }> {
  const stale = await prismaClient.task.findMany({
    where: { status: TaskStatus.OPEN, expiresAt: { lte: new Date() } },
    select: { id: true },
  });

  if (stale.length === 0) return { expired: 0, refunded: 0n };

  let expired = 0;
  let refunded = 0n;

  for (const { id } of stale) {
    try {
      const amount = await prismaClient.$transaction(async (tx) => {
        const closed = await tx.task.updateMany({
          where: { id, status: TaskStatus.OPEN },
          data: { status: TaskStatus.EXPIRED },
        });
        if (closed.count === 0) return 0n;

        const task = await tx.task.findUniqueOrThrow({ where: { id } });
        return refundTaskRemainder(tx, task);
      });
      expired++;
      refunded += amount;
    } catch (error) {
      logger.error("Failed to expire task", {
        taskId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (expired > 0) {
    logger.info("Expired stale tasks", { count: expired, refunded: refunded.toString() });
    await auditSystem(AuditAction.TASK_EXPIRED, {
      entityType: "task",
      metadata: { count: expired, refundedLamports: refunded.toString() },
    });
  }

  return { expired, refunded };
}
