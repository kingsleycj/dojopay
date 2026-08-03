import jwt from "jsonwebtoken";
import { AccountStatus } from "@prisma/client";
import { config } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { ensureCreatorProfile, ensureWorkerProfile } from "../services/account.service.js";
import { auditContextFrom } from "../services/audit.service.js";
function extractToken(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    return token.trim() === "" ? null : token;
}
function verify(token, secret) {
    try {
        const decoded = jwt.verify(token, secret);
        return typeof decoded === "string" ? null : decoded;
    }
    catch {
        return null;
    }
}
/**
 * Authenticate the account.
 *
 * One token per person. Roles are resolved from profiles by the guards below,
 * not encoded in the token — so a user who becomes a creator does not have to
 * sign out and back in.
 */
export async function requireAccount(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next(unauthorized());
    const decoded = verify(token, config.auth.jwtSecret);
    if (!decoded?.accountId)
        return next(unauthorized());
    // Read the account on every request rather than trusting the token's claims:
    // a suspension must take effect immediately, not whenever the token expires.
    const account = await prismaClient.account.findUnique({
        where: { id: decoded.accountId },
        select: { id: true, status: true, statusReason: true },
    });
    if (!account)
        return next(unauthorized());
    if (account.status === AccountStatus.BANNED) {
        return next(forbidden("This account has been closed.", "ACCOUNT_BANNED"));
    }
    if (account.status === AccountStatus.SUSPENDED) {
        return next(forbidden(account.statusReason
            ? `Your account is suspended: ${account.statusReason}`
            : "Your account is suspended.", "ACCOUNT_SUSPENDED"));
    }
    req.accountId = account.id;
    next();
}
/**
 * Require a creator profile, creating it on first use.
 *
 * Posting a task is itself the act of becoming a creator, so there is no
 * separate "sign up as a creator" step.
 */
export async function requireCreator(req, res, next) {
    try {
        if (!req.accountId)
            return next(unauthorized());
        const profile = await ensureCreatorProfile(req.accountId, auditContextFrom(req));
        req.userId = profile.id;
        next();
    }
    catch (error) {
        next(error);
    }
}
export async function requireWorker(req, res, next) {
    try {
        if (!req.accountId)
            return next(unauthorized());
        const profile = await ensureWorkerProfile(req.accountId, auditContextFrom(req));
        req.workerId = profile.id;
        req.userId = profile.id;
        next();
    }
    catch (error) {
        next(error);
    }
}
/**
 * Require a linked wallet.
 *
 * The withdrawal gate: an account can browse, post, and complete tasks with only
 * an email, but SOL has to go somewhere, so payouts need a proven wallet.
 */
export async function requireLinkedWallet(req, _res, next) {
    try {
        if (!req.accountId)
            return next(unauthorized());
        const account = await prismaClient.account.findUnique({
            where: { id: req.accountId },
            select: { walletAddress: true },
        });
        if (!account?.walletAddress) {
            return next(forbidden("Connect a Solana wallet before withdrawing — that is where your SOL will be sent.", "WALLET_REQUIRED"));
        }
        next();
    }
    catch (error) {
        next(error);
    }
}
/**
 * Authenticate an admin.
 *
 * Verified against a separate secret, so a user token — even a forged one — can
 * never satisfy this check.
 */
export async function requireAdmin(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next(unauthorized());
    const decoded = verify(token, config.auth.adminJwtSecret);
    if (!decoded?.adminId)
        return next(unauthorized());
    // A token issued before the 2FA step must not unlock the API.
    if (!decoded.mfa) {
        return next(unauthorized("Two-factor authentication required", "MFA_REQUIRED"));
    }
    const admin = await prismaClient.adminUser.findUnique({
        where: { id: decoded.adminId },
        select: { id: true, role: true, email: true, isActive: true, totpEnabled: true },
    });
    if (!admin?.isActive || !admin.totpEnabled)
        return next(unauthorized());
    req.admin = { id: admin.id, role: admin.role, email: admin.email };
    next();
}
/** Restrict an admin route to particular roles. */
export function requireAdminRole(...roles) {
    return (req, _res, next) => {
        if (!req.admin)
            return next(unauthorized());
        if (!roles.includes(req.admin.role)) {
            return next(forbidden("Your admin role does not permit this action", "INSUFFICIENT_ROLE"));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map