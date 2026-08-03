import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import {
  AccountStatus,
  ActorType,
  AdminRole,
  PayoutStatus,
  Prisma,
  TaskStatus,
} from "@prisma/client";
import { config } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { fakeVerifyForTiming, hashPassword, verifyPassword } from "../lib/password.js";
import { buildTotpUri, createTotpSecret, verifyTotp } from "../lib/totp.js";
import { sendAccountSuspendedEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";
import { AuditAction, auditAdmin, recordAudit, type AuditContext } from "./audit.service.js";
import { badRequest, conflict, notFound, unauthorized } from "../utils/errors.js";

/**
 * Staff tooling.
 *
 * Deliberately constrained: admins can see everything and can moderate
 * accounts and tasks, but cannot move money, adjust balances, or impersonate a
 * user. A compromised admin credential is then a privacy incident rather than a
 * financial one — and every action here writes an audit entry naming the admin
 * who took it.
 */

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** Short-lived token proving the password step passed, before 2FA. */
function issueChallengeToken(adminId: number, purpose: "verify" | "enroll"): string {
  return jwt.sign({ adminId, purpose, mfa: false }, config.auth.adminJwtSecret, {
    expiresIn: "5m",
  });
}

function issueAdminSession(adminId: number): { token: string; expiresIn: string } {
  return {
    token: jwt.sign({ adminId, mfa: true }, config.auth.adminJwtSecret, {
      expiresIn: config.auth.adminTokenTtl,
    }),
    expiresIn: config.auth.adminTokenTtl,
  };
}

function verifyChallengeToken(token: string, purpose: "verify" | "enroll"): number {
  try {
    const decoded = jwt.verify(token, config.auth.adminJwtSecret) as {
      adminId?: number;
      purpose?: string;
    };
    if (!decoded.adminId || decoded.purpose !== purpose) {
      throw new Error("wrong purpose");
    }
    return decoded.adminId;
  } catch {
    throw unauthorized("That login attempt expired — start again", "CHALLENGE_EXPIRED");
  }
}

/**
 * Step one: email and password.
 *
 * Never returns a usable session. Either a 2FA challenge (already enrolled) or
 * an enrolment challenge with a QR code (first login).
 */
export async function adminLoginStep1(input: {
  email: string;
  password: string;
  context?: AuditContext;
}) {
  const email = input.email.trim().toLowerCase();
  const admin = await prismaClient.adminUser.findUnique({ where: { email } });

  if (!admin || !admin.isActive) {
    await fakeVerifyForTiming();
    await recordAudit({
      action: AuditAction.ADMIN_LOGIN_FAILED,
      actorType: ActorType.SYSTEM,
      metadata: { email, reason: admin ? "INACTIVE" : "NO_SUCH_ADMIN" },
      context: input.context,
    });
    throw unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
  }

  if (!(await verifyPassword(admin.passwordHash, input.password))) {
    await auditAdmin(admin.id, AuditAction.ADMIN_LOGIN_FAILED, {
      metadata: { email, reason: "BAD_PASSWORD" },
      context: input.context,
    });
    throw unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
  }

  // First login: force 2FA enrolment before the account can be used at all.
  if (!admin.totpEnabled) {
    const secret = admin.totpSecret ?? createTotpSecret();

    if (!admin.totpSecret) {
      await prismaClient.adminUser.update({
        where: { id: admin.id },
        data: { totpSecret: secret },
      });
    }

    const otpauth = buildTotpUri(secret, admin.email);

    return {
      stage: "ENROLL_2FA" as const,
      challengeToken: issueChallengeToken(admin.id, "enroll"),
      // The secret is shown once, during enrolment, and never again.
      totpSecret: secret,
      qrCodeDataUrl: await QRCode.toDataURL(otpauth),
    };
  }

  return {
    stage: "VERIFY_2FA" as const,
    challengeToken: issueChallengeToken(admin.id, "verify"),
  };
}

/** Step two: the 6-digit code. Only this issues a usable session. */
export async function adminLoginStep2(input: {
  challengeToken: string;
  code: string;
  context?: AuditContext;
}) {
  const adminId = verifyChallengeToken(input.challengeToken, "verify");
  const admin = await prismaClient.adminUser.findUnique({ where: { id: adminId } });

  if (!admin?.totpSecret || !admin.isActive) throw unauthorized();

  if (!verifyTotp(admin.totpSecret, input.code)) {
    await auditAdmin(admin.id, AuditAction.ADMIN_LOGIN_FAILED, {
      metadata: { reason: "BAD_TOTP" },
      context: input.context,
    });
    throw unauthorized("That code is not valid", "INVALID_TOTP");
  }

  await prismaClient.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await auditAdmin(admin.id, AuditAction.ADMIN_LOGIN, { context: input.context });

  return {
    ...issueAdminSession(admin.id),
    admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role },
  };
}

/** Confirm enrolment by proving the authenticator app is set up correctly. */
export async function adminEnrollTotp(input: {
  challengeToken: string;
  code: string;
  context?: AuditContext;
}) {
  const adminId = verifyChallengeToken(input.challengeToken, "enroll");
  const admin = await prismaClient.adminUser.findUnique({ where: { id: adminId } });

  if (!admin?.totpSecret) throw unauthorized();

  if (!verifyTotp(admin.totpSecret, input.code)) {
    throw unauthorized("That code is not valid — check your authenticator app", "INVALID_TOTP");
  }

  await prismaClient.adminUser.update({
    where: { id: admin.id },
    data: { totpEnabled: true, lastLoginAt: new Date() },
  });

  await auditAdmin(admin.id, AuditAction.ADMIN_2FA_ENROLLED, { context: input.context });

  return {
    ...issueAdminSession(admin.id),
    admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role },
  };
}

/**
 * Create an admin.
 *
 * No HTTP route reaches this without an OWNER session; the very first admin is
 * created by the `admin:create` CLI script directly against the database, so
 * there is no self-registration path at all.
 */
export async function createAdmin(input: {
  email: string;
  password: string;
  displayName: string;
  role: AdminRole;
  createdByAdminId?: number;
  context?: AuditContext;
}) {
  const email = input.email.trim().toLowerCase();

  const existing = await prismaClient.adminUser.findUnique({ where: { email } });
  if (existing) throw conflict("An admin with that email already exists", "ADMIN_EXISTS");

  const admin = await prismaClient.adminUser.create({
    data: {
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      role: input.role,
    },
  });

  await recordAudit({
    action: AuditAction.ADMIN_CREATED,
    actorType: input.createdByAdminId ? ActorType.ADMIN : ActorType.SYSTEM,
    actorAdminId: input.createdByAdminId ?? null,
    entityType: "admin",
    entityId: admin.id,
    metadata: { email, role: input.role },
    context: input.context,
  });

  return { id: admin.id, email: admin.email, role: admin.role };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Numbers the operator actually needs on a single screen. */
export async function getOverview() {
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS);
  const weekAgo = new Date(now - 7 * DAY_MS);

  const [
    totalAccounts,
    newAccountsToday,
    newAccountsWeek,
    suspendedAccounts,
    walletLinked,
    totalTasks,
    openTasks,
    totalSubmissions,
    submissionsToday,
    payoutAgg,
    failedPayouts,
    pendingAgg,
    recentSignups,
    criticalEvents,
  ] = await Promise.all([
    prismaClient.account.count(),
    prismaClient.account.count({ where: { createdAt: { gte: dayAgo } } }),
    prismaClient.account.count({ where: { createdAt: { gte: weekAgo } } }),
    prismaClient.account.count({ where: { status: AccountStatus.SUSPENDED } }),
    prismaClient.account.count({ where: { walletAddress: { not: null } } }),
    prismaClient.task.count(),
    prismaClient.task.count({ where: { status: TaskStatus.OPEN } }),
    prismaClient.submission.count(),
    prismaClient.submission.count({ where: { createdAt: { gte: dayAgo } } }),
    prismaClient.payouts.aggregate({
      where: { status: PayoutStatus.SUCCESS },
      _sum: { amount: true },
      _count: true,
    }),
    prismaClient.payouts.count({ where: { status: PayoutStatus.FAILED } }),
    prismaClient.worker.aggregate({ _sum: { pending_amount: true } }),
    prismaClient.account.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
        signupProvider: true,
        status: true,
        createdAt: true,
      },
    }),
    prismaClient.auditLog.findMany({
      where: { severity: { in: ["WARNING", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        actorAccount: { select: { id: true, email: true, displayName: true } },
        actorAdmin: { select: { id: true, email: true, displayName: true } },
      },
    }),
  ]);

  return {
    accounts: {
      total: totalAccounts,
      newToday: newAccountsToday,
      newThisWeek: newAccountsWeek,
      suspended: suspendedAccounts,
      withWallet: walletLinked,
      // The share of users who can actually be paid — the key funnel metric for
      // an email-first signup flow.
      walletLinkRate:
        totalAccounts > 0 ? ((walletLinked / totalAccounts) * 100).toFixed(1) : "0",
    },
    tasks: { total: totalTasks, open: openTasks },
    work: { totalSubmissions, submissionsToday },
    money: {
      totalPaidOutLamports: (payoutAgg._sum.amount ?? 0n).toString(),
      payoutCount: payoutAgg._count,
      failedPayouts,
      /** Money owed to workers but not yet withdrawn — the platform's liability. */
      outstandingLiabilityLamports: (pendingAgg._sum.pending_amount ?? 0n).toString(),
    },
    recentSignups,
    criticalEvents,
  };
}

/** Daily signups and submissions, for the overview chart. */
export async function getGrowthSeries(days = 30) {
  const since = new Date(Date.now() - days * DAY_MS);

  const [accounts, submissions, tasks] = await Promise.all([
    prismaClient.account.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prismaClient.submission.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prismaClient.task.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const key = (date: Date) => date.toISOString().slice(0, 10);
  const buckets = new Map<string, { signups: number; submissions: number; tasks: number }>();

  for (let offset = days - 1; offset >= 0; offset--) {
    buckets.set(key(new Date(Date.now() - offset * DAY_MS)), {
      signups: 0,
      submissions: 0,
      tasks: 0,
    });
  }

  for (const row of accounts) {
    const bucket = buckets.get(key(row.createdAt));
    if (bucket) bucket.signups += 1;
  }
  for (const row of submissions) {
    const bucket = buckets.get(key(row.createdAt));
    if (bucket) bucket.submissions += 1;
  }
  for (const row of tasks) {
    const bucket = buckets.get(key(row.createdAt));
    if (bucket) bucket.tasks += 1;
  }

  return [...buckets.entries()].map(([date, values]) => ({ date, ...values }));
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface AccountListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AccountStatus;
  provider?: "EMAIL" | "GOOGLE" | "WALLET";
  sort: "newest" | "oldest" | "lastActive";
}

export async function listAccounts(query: AccountListQuery) {
  const where: Prisma.AccountWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.provider ? { signupProvider: query.provider } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { displayName: { contains: query.search, mode: "insensitive" } },
            { walletAddress: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.AccountOrderByWithRelationInput =
    query.sort === "oldest"
      ? { createdAt: "asc" }
      : query.sort === "lastActive"
        ? { lastLoginAt: "desc" }
        : { createdAt: "desc" };

  const [total, accounts] = await Promise.all([
    prismaClient.account.count({ where }),
    prismaClient.account.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        email: true,
        emailVerified: true,
        displayName: true,
        walletAddress: true,
        signupProvider: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        creatorProfile: { select: { id: true, _count: { select: { tasks: true } } } },
        workerProfile: {
          select: {
            id: true,
            pending_amount: true,
            withdrawn_amount: true,
            _count: { select: { submissions: true } },
          },
        },
      },
    }),
  ]);

  return {
    accounts,
    pagination: {
      currentPage: query.page,
      itemsPerPage: query.limit,
      totalItems: total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

/** Full picture of one account, for the admin detail view. */
export async function getAccountDetail(accountId: number, viewedByAdminId: number) {
  const account = await prismaClient.account.findUnique({
    where: { id: accountId },
    include: {
      creatorProfile: {
        include: {
          tasks: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              title: true,
              status: true,
              amount: true,
              submissionCount: true,
              createdAt: true,
            },
          },
        },
      },
      workerProfile: {
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { task: { select: { id: true, title: true } } },
          },
          payouts: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
  });

  if (!account) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");

  // Viewing someone's full record is itself an auditable event — staff access to
  // user data should be reviewable.
  await auditAdmin(viewedByAdminId, AuditAction.ADMIN_VIEWED_ACCOUNT, {
    entityType: "account",
    entityId: accountId,
  });

  // Never expose credential material, even to admins.
  const { passwordHash, googleId, ...safe } = account;

  return { ...safe, hasPassword: Boolean(passwordHash), hasGoogle: Boolean(googleId) };
}

/**
 * Suspend, ban, or reactivate an account.
 *
 * A reason is mandatory: it is written to the audit log and emailed to the user,
 * so nobody is left guessing why they lost access.
 */
export async function moderateAccount(input: {
  accountId: number;
  adminId: number;
  action: "SUSPEND" | "BAN" | "REACTIVATE";
  reason: string;
  context?: AuditContext;
}) {
  const account = await prismaClient.account.findUnique({
    where: { id: input.accountId },
    include: { workerProfile: { select: { pending_amount: true } } },
  });
  if (!account) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");

  const status =
    input.action === "REACTIVATE"
      ? AccountStatus.ACTIVE
      : input.action === "BAN"
        ? AccountStatus.BANNED
        : AccountStatus.SUSPENDED;

  if (account.status === status) {
    throw badRequest(`Account is already ${status.toLowerCase()}`, "NO_CHANGE");
  }

  const updated = await prismaClient.account.update({
    where: { id: input.accountId },
    data: {
      status,
      statusReason: input.action === "REACTIVATE" ? null : input.reason,
      statusChangedAt: new Date(),
    },
  });

  const action =
    input.action === "REACTIVATE"
      ? AuditAction.ADMIN_ACCOUNT_REACTIVATED
      : input.action === "BAN"
        ? AuditAction.ADMIN_ACCOUNT_BANNED
        : AuditAction.ADMIN_ACCOUNT_SUSPENDED;

  await auditAdmin(input.adminId, action, {
    entityType: "account",
    entityId: input.accountId,
    metadata: {
      reason: input.reason,
      previousStatus: account.status,
      newStatus: status,
      // Flagged because banning someone who is owed money needs a human
      // decision about how they get paid.
      outstandingBalance: (account.workerProfile?.pending_amount ?? 0n).toString(),
    },
    context: input.context,
  });

  if (account.email && input.action !== "REACTIVATE") {
    await sendAccountSuspendedEmail(account.email, input.reason).catch((error) =>
      logger.error("Suspension email failed", {
        accountId: input.accountId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  return { id: updated.id, status: updated.status, statusReason: updated.statusReason };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(query: { page: number; limit: number; status?: TaskStatus }) {
  const where: Prisma.TaskWhereInput = query.status ? { status: query.status } : {};

  const [total, tasks] = await Promise.all([
    prismaClient.task.count({ where }),
    prismaClient.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        user: {
          select: {
            id: true,
            account: { select: { id: true, email: true, displayName: true, walletAddress: true } },
          },
        },
      },
    }),
  ]);

  return {
    tasks,
    pagination: {
      currentPage: query.page,
      itemsPerPage: query.limit,
      totalItems: total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

/**
 * Force-close an abusive task.
 *
 * Stops further submissions. Deliberately does not touch money: workers who
 * already submitted keep what they earned, and refunding the creator's unspent
 * balance is a separate decision made off-platform.
 */
export async function forceCloseTask(input: {
  taskId: number;
  adminId: number;
  reason: string;
  context?: AuditContext;
}) {
  const task = await prismaClient.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw notFound("Task not found", "TASK_NOT_FOUND");

  if (task.status !== TaskStatus.OPEN) {
    throw badRequest("Only open tasks can be force-closed", "TASK_NOT_OPEN");
  }

  const updated = await prismaClient.task.update({
    where: { id: input.taskId },
    data: {
      status: TaskStatus.FORCE_CLOSED,
      done: true,
      moderationReason: input.reason,
    },
  });

  await auditAdmin(input.adminId, AuditAction.ADMIN_TASK_FORCE_CLOSED, {
    entityType: "task",
    entityId: input.taskId,
    metadata: {
      reason: input.reason,
      submissionsAtClose: task.submissionCount,
      creatorProfileId: task.user_id,
    },
    context: input.context,
  });

  return { id: updated.id, status: updated.status };
}
