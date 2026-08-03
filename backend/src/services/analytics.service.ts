import { PayoutStatus, TaskStatus } from "@prisma/client";
import { prismaClient } from "../lib/prisma.js";
import { effectiveStatus } from "./task.service.js";
import { ensureVault, serializeVault } from "./vault.service.js";

/**
 * Creator analytics.
 *
 * Every figure here is computed from real `createdAt` timestamps. The previous
 * implementation bucketed all tasks into "the current week/month" regardless of
 * age, reported `new Date()` as every task's creation time, and returned a
 * hardcoded `"85%"` retention rate. Charts built on that were decorative.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Count items per day for the last `days` days, oldest first. */
function bucketByDay<T>(items: T[], getDate: (item: T) => Date, days: number) {
  const buckets = new Map<string, T[]>();
  const now = Date.now();

  for (let offset = days - 1; offset >= 0; offset--) {
    buckets.set(dateKey(new Date(now - offset * DAY_MS)), []);
  }

  for (const item of items) {
    const key = dateKey(getDate(item));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
  }

  return buckets;
}

export async function getCreatorDashboard(userId: number) {
  const creator = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { account_id: true },
  });

  const [tasks, vault] = await Promise.all([
    prismaClient.task.findMany({
      where: { user_id: userId },
      include: { submissions: { select: { id: true, createdAt: true, amount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    creator ? ensureVault(creator.account_id) : null,
  ]);

  const allSubmissions = tasks.flatMap((task) => task.submissions);

  const totalTasks = tasks.length;
  const totalSubmissions = allSubmissions.length;
  const totalCommitted = tasks.reduce((sum, task) => sum + task.amount, 0n);
  const totalRefunded = tasks.reduce((sum, task) => sum + task.refundedAmount, 0n);

  /**
   * What the creator has actually parted with.
   *
   * Committing a budget is not the same as spending it now that unfilled slots
   * come back — this used to sum `task.amount` and call it "total spent", which
   * overstated the bill for every task that expired half-full.
   */
  const totalSpent = totalCommitted - totalRefunded;

  /** Purchased capacity, summed per task rather than assuming a global cap. */
  const totalCapacity = tasks.reduce((sum, task) => sum + task.maxSubmissions, 0);

  const statuses = tasks.map(effectiveStatus);
  const completedTasks = statuses.filter((status) => status === TaskStatus.COMPLETED).length;
  const pendingTasks = statuses.filter((status) => status === TaskStatus.OPEN).length;
  const expiredTasks = statuses.filter((status) => status === TaskStatus.EXPIRED).length;

  /**
   * What has actually been earned by workers on this creator's tasks. Derived
   * from submissions rather than the Payouts table: a payout is a worker
   * emptying their whole balance across all creators, so attributing payouts to
   * one creator — as the old code did — double-counted across creators.
   */
  const distributedToWorkers = allSubmissions.reduce((sum, submission) => sum + submission.amount, 0n);

  const taskBuckets = bucketByDay(tasks, (task) => task.createdAt, 7);
  const submissionBuckets = bucketByDay(allSubmissions, (submission) => submission.createdAt, 7);

  const dailyStats = [...taskBuckets.entries()].map(([date, dayTasks]) => ({
    date,
    tasksCreated: dayTasks.length,
    submissionsReceived: submissionBuckets.get(date)?.length ?? 0,
  }));

  // Four real ISO-ish weeks, oldest first.
  const weeklyStats = Array.from({ length: 4 }, (_, index) => {
    const weeksAgo = 3 - index;
    const end = new Date(Date.now() - weeksAgo * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);

    return {
      weekStart: dateKey(start),
      weekEnd: dateKey(end),
      tasksCreated: tasks.filter((task) => task.createdAt >= start && task.createdAt < end).length,
      submissionsReceived: allSubmissions.filter((s) => s.createdAt >= start && s.createdAt < end).length,
    };
  });

  const now = new Date();
  const monthlyStats = Array.from({ length: 12 }, (_, index) => {
    const monthsAgo = 11 - index;
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
    const monthTasks = tasks.filter((task) => task.createdAt >= start && task.createdAt < end);

    return {
      month: start.toLocaleString("en-US", { month: "short", year: "numeric" }),
      tasksCreated: monthTasks.length,
      submissionsReceived: allSubmissions.filter((s) => s.createdAt >= start && s.createdAt < end).length,
      // Capacity actually bought that month, not `tasks × a global constant`.
      capacity: monthTasks.reduce((sum, task) => sum + task.maxSubmissions, 0),
    };
  });

  const completionTrend = monthlyStats.map((stat) => ({
    period: stat.month,
    // Fill rate: how much of the purchased capacity was actually used.
    completionRate:
      stat.capacity > 0 ? Math.min(100, (stat.submissionsReceived / stat.capacity) * 100) : 0,
  }));

  return {
    overview: {
      totalTasks,
      totalSubmissions,
      totalSpent: totalSpent.toString(),
      /** Everything ever committed, including budget that later came back. */
      totalCommitted: totalCommitted.toString(),
      /** Unfilled slots returned to the vault. */
      totalRefunded: totalRefunded.toString(),
      totalPayouts: distributedToWorkers.toString(),
      completedTasks,
      pendingTasks,
      expiredTasks,
      averageSubmissionsPerTask: totalTasks > 0 ? (totalSubmissions / totalTasks).toFixed(2) : "0",
      capacityUtilisation:
        totalCapacity > 0 ? ((totalSubmissions / totalCapacity) * 100).toFixed(1) : "0",
    },
    vault: vault ? serializeVault(vault) : null,
    dailyStats,
    weeklyStats,
    monthlyStats,
    completionTrend,
    recentActivity: tasks.slice(0, 10).map((task) => ({
      id: task.id,
      title: task.title,
      status: effectiveStatus(task),
      createdAt: task.createdAt.toISOString(),
      expiresAt: task.expiresAt?.toISOString() ?? null,
      amount: task.amount.toString(),
      rewardPerSubmission: task.rewardPerSubmission.toString(),
      submissions: task.submissionCount,
      maxSubmissions: task.maxSubmissions,
    })),
  };
}

export async function getCreatorEarnings(userId: number) {
  const tasks = await prismaClient.task.findMany({
    where: { user_id: userId },
    include: {
      submissions: { include: { worker: { include: { account: { select: { walletAddress: true, displayName: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalTasks = tasks.length;
  const totalCommitted = tasks.reduce((sum, task) => sum + task.amount, 0n);
  const totalRefunded = tasks.reduce((sum, task) => sum + task.refundedAmount, 0n);
  const totalSpent = totalCommitted - totalRefunded;
  const statuses = tasks.map(effectiveStatus);
  const completedTasks = statuses.filter((status) => status === TaskStatus.COMPLETED).length;
  const pendingTasks = statuses.filter((status) => status === TaskStatus.OPEN).length;

  const workerIds = new Set<number>();
  const earnings: Array<Record<string, unknown>> = [];

  // A worker's payout status is per-worker, not per-submission, so resolve it
  // once per worker rather than re-scanning the payout list inside the loop.
  const allWorkerIds = [...new Set(tasks.flatMap((t) => t.submissions.map((s) => s.worker_id)))];
  const successfulPayouts = allWorkerIds.length
    ? await prismaClient.payouts.findMany({
        where: { worker_id: { in: allWorkerIds }, status: PayoutStatus.SUCCESS },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const latestPayoutByWorker = new Map<number, (typeof successfulPayouts)[number]>();
  for (const payout of successfulPayouts) {
    if (payout.worker_id !== null && !latestPayoutByWorker.has(payout.worker_id)) {
      latestPayoutByWorker.set(payout.worker_id, payout);
    }
  }

  for (const task of tasks) {
    for (const submission of task.submissions) {
      workerIds.add(submission.worker_id);
      const payout = latestPayoutByWorker.get(submission.worker_id);
      // Paid means: this submission predates a confirmed withdrawal by that worker.
      const paid = payout ? payout.createdAt >= submission.createdAt : false;

      earnings.push({
        id: submission.id,
        amount: submission.amount.toString(),
        date: submission.createdAt.toISOString(),
        status: paid ? "paid" : "pending",
        transactionHash: paid ? payout?.signature : undefined,
        taskId: task.id,
        taskTitle: task.title,
        workerAddress: submission.worker.account.walletAddress ?? `worker-${submission.worker_id}`,
        submissionId: submission.id,
      });
    }
  }

  const spentSince = (since: number) =>
    tasks
      .filter((task) => task.createdAt.getTime() >= since)
      .reduce((sum, task) => sum + task.amount - task.refundedAmount, 0n)
      .toString();

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  /**
   * Share of workers who came back for a second task. Real ratio — the old
   * value was the literal string "85%".
   */
  const submissionsPerWorker = new Map<number, number>();
  for (const task of tasks) {
    for (const submission of task.submissions) {
      submissionsPerWorker.set(
        submission.worker_id,
        (submissionsPerWorker.get(submission.worker_id) ?? 0) + 1,
      );
    }
  }
  const returningWorkers = [...submissionsPerWorker.values()].filter((count) => count > 1).length;
  const retentionRate =
    workerIds.size > 0 ? `${((returningWorkers / workerIds.size) * 100).toFixed(0)}%` : "0%";

  return {
    totalSpent: totalSpent.toString(),
    totalTasks,
    completedTasks,
    pendingTasks,
    averageTaskCost: totalTasks > 0 ? (totalSpent / BigInt(totalTasks)).toString() : "0",
    earnings,
    metrics: {
      monthlySpent: spentSince(monthStart),
      weeklySpent: spentSince(now - 7 * DAY_MS),
      dailySpent: spentSince(now - DAY_MS),
      totalWorkers: workerIds.size,
      returningWorkers,
      retentionRate,
    },
  };
}
