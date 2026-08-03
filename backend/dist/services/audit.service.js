import { ActorType, AuditSeverity } from "@prisma/client";
import { prismaClient } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
/**
 * Append-only activity log.
 *
 * Everything an account or an admin does lands here so the admin section can
 * answer "what happened to this user, and who did it". Two rules:
 *
 *  1. **Writing an audit entry must never break the action being audited.**
 *     A failed log write is logged and swallowed — refusing a worker's
 *     submission because the audit table is unavailable would be worse than
 *     losing one line of history.
 *  2. **Never put secrets in `metadata`.** Every admin can read this table.
 */
/** Canonical action verbs. A closed set keeps the admin UI filterable. */
export const AuditAction = {
    // Identity
    ACCOUNT_REGISTERED: "ACCOUNT_REGISTERED",
    ACCOUNT_LOGIN: "ACCOUNT_LOGIN",
    ACCOUNT_LOGIN_FAILED: "ACCOUNT_LOGIN_FAILED",
    ACCOUNT_LOGOUT: "ACCOUNT_LOGOUT",
    EMAIL_VERIFICATION_SENT: "EMAIL_VERIFICATION_SENT",
    EMAIL_VERIFIED: "EMAIL_VERIFIED",
    PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
    PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    WALLET_LINKED: "WALLET_LINKED",
    WALLET_UNLINKED: "WALLET_UNLINKED",
    EMAIL_LINKED: "EMAIL_LINKED",
    GOOGLE_LINKED: "GOOGLE_LINKED",
    PROFILE_UPDATED: "PROFILE_UPDATED",
    // Roles
    CREATOR_PROFILE_CREATED: "CREATOR_PROFILE_CREATED",
    WORKER_PROFILE_CREATED: "WORKER_PROFILE_CREATED",
    // Tasks
    TASK_CREATED: "TASK_CREATED",
    TASK_UPDATED: "TASK_UPDATED",
    TASK_COMPLETED: "TASK_COMPLETED",
    TASK_EXPIRED: "TASK_EXPIRED",
    SUBMISSION_CREATED: "SUBMISSION_CREATED",
    // Money
    PAYOUT_REQUESTED: "PAYOUT_REQUESTED",
    PAYOUT_SUCCEEDED: "PAYOUT_SUCCEEDED",
    PAYOUT_FAILED: "PAYOUT_FAILED",
    PAYOUT_REJECTED: "PAYOUT_REJECTED",
    // Admin
    ADMIN_LOGIN: "ADMIN_LOGIN",
    ADMIN_LOGIN_FAILED: "ADMIN_LOGIN_FAILED",
    ADMIN_2FA_ENROLLED: "ADMIN_2FA_ENROLLED",
    ADMIN_VIEWED_ACCOUNT: "ADMIN_VIEWED_ACCOUNT",
    ADMIN_ACCOUNT_SUSPENDED: "ADMIN_ACCOUNT_SUSPENDED",
    ADMIN_ACCOUNT_REACTIVATED: "ADMIN_ACCOUNT_REACTIVATED",
    ADMIN_ACCOUNT_BANNED: "ADMIN_ACCOUNT_BANNED",
    ADMIN_TASK_FORCE_CLOSED: "ADMIN_TASK_FORCE_CLOSED",
    ADMIN_CREATED: "ADMIN_CREATED",
};
/** Actions that should stand out in the admin feed without needing a filter. */
const SEVERITY_BY_ACTION = {
    ACCOUNT_LOGIN_FAILED: AuditSeverity.NOTICE,
    PASSWORD_RESET_REQUESTED: AuditSeverity.NOTICE,
    PASSWORD_RESET_COMPLETED: AuditSeverity.WARNING,
    PASSWORD_CHANGED: AuditSeverity.NOTICE,
    WALLET_LINKED: AuditSeverity.WARNING,
    WALLET_UNLINKED: AuditSeverity.WARNING,
    PAYOUT_REQUESTED: AuditSeverity.NOTICE,
    PAYOUT_SUCCEEDED: AuditSeverity.NOTICE,
    PAYOUT_FAILED: AuditSeverity.WARNING,
    PAYOUT_REJECTED: AuditSeverity.WARNING,
    ADMIN_LOGIN: AuditSeverity.NOTICE,
    ADMIN_LOGIN_FAILED: AuditSeverity.CRITICAL,
    ADMIN_ACCOUNT_SUSPENDED: AuditSeverity.CRITICAL,
    ADMIN_ACCOUNT_REACTIVATED: AuditSeverity.WARNING,
    ADMIN_ACCOUNT_BANNED: AuditSeverity.CRITICAL,
    ADMIN_TASK_FORCE_CLOSED: AuditSeverity.CRITICAL,
    ADMIN_CREATED: AuditSeverity.CRITICAL,
    ADMIN_2FA_ENROLLED: AuditSeverity.WARNING,
};
/** Pull the request context an audit entry should carry. */
export function auditContextFrom(req) {
    return {
        ipAddress: req.ip ?? req.socket.remoteAddress ?? undefined,
        // Truncated: user agents can be arbitrarily long and this is not the place
        // to store them in full.
        userAgent: req.get("user-agent")?.slice(0, 500),
    };
}
export async function recordAudit(input) {
    try {
        await prismaClient.auditLog.create({
            data: {
                action: input.action,
                actorType: input.actorType,
                actorAccountId: input.actorAccountId ?? null,
                actorAdminId: input.actorAdminId ?? null,
                entityType: input.entityType ?? null,
                entityId: input.entityId === undefined ? null : String(input.entityId),
                metadata: (input.metadata ?? undefined),
                severity: input.severity ?? SEVERITY_BY_ACTION[input.action] ?? AuditSeverity.INFO,
                ipAddress: input.context?.ipAddress ?? null,
                userAgent: input.context?.userAgent ?? null,
            },
        });
    }
    catch (error) {
        // Rule 1: auditing must not take down the thing it audits.
        logger.error("Failed to write audit log", {
            action: input.action,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/** Convenience wrapper for account-initiated actions. */
export function auditAccount(accountId, action, options = {}) {
    return recordAudit({
        ...options,
        action,
        actorType: ActorType.ACCOUNT,
        actorAccountId: accountId ?? null,
    });
}
/** Convenience wrapper for admin-initiated actions. */
export function auditAdmin(adminId, action, options = {}) {
    return recordAudit({
        ...options,
        action,
        actorType: ActorType.ADMIN,
        actorAdminId: adminId,
    });
}
/** Convenience wrapper for background jobs. */
export function auditSystem(action, options = {}) {
    return recordAudit({ ...options, action, actorType: ActorType.SYSTEM });
}
/** Filtered, paginated read for the admin activity feed. */
export async function queryAuditLog(query) {
    const where = {
        ...(query.action ? { action: query.action } : {}),
        ...(query.actorType ? { actorType: query.actorType } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.accountId ? { actorAccountId: query.accountId } : {}),
        ...(query.adminId ? { actorAdminId: query.adminId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.from || query.to
            ? {
                createdAt: {
                    ...(query.from ? { gte: query.from } : {}),
                    ...(query.to ? { lte: query.to } : {}),
                },
            }
            : {}),
    };
    const [total, entries] = await Promise.all([
        prismaClient.auditLog.count({ where }),
        prismaClient.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            include: {
                actorAccount: { select: { id: true, email: true, displayName: true, walletAddress: true } },
                actorAdmin: { select: { id: true, email: true, displayName: true, role: true } },
            },
        }),
    ]);
    return {
        entries,
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
/** Everything that ever happened to one account, for the admin detail view. */
export async function accountTimeline(accountId, limit = 100) {
    return prismaClient.auditLog.findMany({
        where: {
            OR: [
                { actorAccountId: accountId },
                // Admin actions taken *against* this account.
                { entityType: "account", entityId: String(accountId) },
            ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            actorAdmin: { select: { id: true, email: true, displayName: true } },
        },
    });
}
//# sourceMappingURL=audit.service.js.map