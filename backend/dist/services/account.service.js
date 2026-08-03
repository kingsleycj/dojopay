import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
import { AccountStatus, AuthProvider, TokenType } from "@prisma/client";
import { config } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { isValidPublicKey, toSignatureBytes } from "../lib/solana.js";
import { fakeVerifyForTiming, generateToken, hashPassword, hashToken, validatePasswordStrength, verifyPassword, } from "../lib/password.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/mailer.js";
import { AuditAction, auditAccount } from "./audit.service.js";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../utils/errors.js";
function issueToken(accountId) {
    return {
        token: jwt.sign({ accountId }, config.auth.jwtSecret, {
            expiresIn: config.auth.tokenTtl,
        }),
        expiresIn: config.auth.tokenTtl,
    };
}
/** Emails are matched case-insensitively; store them lowercased. */
function normaliseEmail(email) {
    return email.trim().toLowerCase();
}
function assertUsable(account) {
    if (account.status === AccountStatus.BANNED) {
        throw forbidden("This account has been permanently closed.", "ACCOUNT_BANNED");
    }
    if (account.status === AccountStatus.SUSPENDED) {
        throw forbidden(account.statusReason
            ? `Your account is suspended: ${account.statusReason}`
            : "Your account is suspended.", "ACCOUNT_SUSPENDED");
    }
}
/** Public shape of an account. Never leaks hashes, tokens, or Google ids. */
export function toPublicAccount(account) {
    return {
        id: account.id,
        email: account.email,
        emailVerified: account.emailVerified,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        walletAddress: account.walletAddress,
        walletLinkedAt: account.walletLinkedAt?.toISOString() ?? null,
        status: account.status,
        signupProvider: account.signupProvider,
        hasPassword: Boolean(account.passwordHash),
        hasGoogle: Boolean(account.googleId),
        /** Drives the "connect a wallet to withdraw" prompt in the UI. */
        canWithdraw: Boolean(account.walletAddress),
        roles: {
            creator: Boolean(account.creatorProfile),
            worker: Boolean(account.workerProfile),
        },
        createdAt: account.createdAt.toISOString(),
    };
}
async function loadAccount(accountId) {
    const account = await prismaClient.account.findUnique({
        where: { id: accountId },
        include: { creatorProfile: true, workerProfile: true },
    });
    if (!account)
        throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    return account;
}
export { loadAccount as getAccount };
// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------
export async function registerWithEmail(input) {
    const email = normaliseEmail(input.email);
    const weakness = validatePasswordStrength(input.password);
    if (weakness)
        throw badRequest(weakness, "WEAK_PASSWORD");
    const existing = await prismaClient.account.findUnique({ where: { email } });
    if (existing) {
        // Deliberately explicit rather than silently pretending to succeed: for a
        // marketplace where people need to reach their earnings, "this email is
        // taken, try signing in" beats a mysterious no-op. Enumeration risk is
        // accepted here and mitigated on the password-reset path instead.
        throw conflict("An account with this email already exists. Try signing in instead.", "EMAIL_TAKEN");
    }
    const account = await prismaClient.account.create({
        data: {
            email,
            passwordHash: await hashPassword(input.password),
            displayName: input.displayName?.trim() || email.split("@")[0],
            signupProvider: AuthProvider.EMAIL,
            referredBy: input.referredBy ?? null,
        },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(account.id, AuditAction.ACCOUNT_REGISTERED, {
        entityType: "account",
        entityId: account.id,
        metadata: { provider: "EMAIL", referredBy: input.referredBy ?? null },
        context: input.context,
    });
    // Registration succeeds even if the email fails to send — the user can ask
    // for another one rather than losing the account they just created.
    await issueEmailVerification(account.id, email, input.context).catch((error) => logger.error("Verification email failed at registration", {
        accountId: account.id,
        error: error instanceof Error ? error.message : String(error),
    }));
    return { account: toPublicAccount(account), ...issueToken(account.id) };
}
export async function loginWithEmail(input) {
    const email = normaliseEmail(input.email);
    const account = await prismaClient.account.findUnique({
        where: { email },
        include: { creatorProfile: true, workerProfile: true },
    });
    if (!account?.passwordHash) {
        // Equalise timing so a missing account is indistinguishable from a wrong
        // password.
        await fakeVerifyForTiming();
        await auditAccount(account?.id ?? null, AuditAction.ACCOUNT_LOGIN_FAILED, {
            metadata: { email, reason: account ? "NO_PASSWORD_SET" : "NO_SUCH_ACCOUNT" },
            context: input.context,
        });
        throw unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
    }
    const valid = await verifyPassword(account.passwordHash, input.password);
    if (!valid) {
        await auditAccount(account.id, AuditAction.ACCOUNT_LOGIN_FAILED, {
            metadata: { email, reason: "BAD_PASSWORD" },
            context: input.context,
        });
        throw unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
    }
    assertUsable(account);
    await prismaClient.account.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
    });
    await auditAccount(account.id, AuditAction.ACCOUNT_LOGIN, {
        metadata: { provider: "EMAIL" },
        context: input.context,
    });
    return { account: toPublicAccount(account), ...issueToken(account.id) };
}
// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------
/**
 * Resolve a Google profile to an account.
 *
 * If the verified Google email matches an existing account, the identities are
 * merged rather than creating a duplicate — Google has verified the address, so
 * this is safe and avoids the classic "I have two accounts now" complaint.
 */
export async function upsertGoogleAccount(input) {
    const email = normaliseEmail(input.email);
    const byGoogleId = await prismaClient.account.findUnique({
        where: { googleId: input.googleId },
        include: { creatorProfile: true, workerProfile: true },
    });
    if (byGoogleId) {
        assertUsable(byGoogleId);
        await prismaClient.account.update({
            where: { id: byGoogleId.id },
            data: { lastLoginAt: new Date() },
        });
        await auditAccount(byGoogleId.id, AuditAction.ACCOUNT_LOGIN, {
            metadata: { provider: "GOOGLE" },
            context: input.context,
        });
        return { account: toPublicAccount(byGoogleId), ...issueToken(byGoogleId.id) };
    }
    const byEmail = await prismaClient.account.findUnique({
        where: { email },
        include: { creatorProfile: true, workerProfile: true },
    });
    if (byEmail) {
        assertUsable(byEmail);
        const linked = await prismaClient.account.update({
            where: { id: byEmail.id },
            data: {
                googleId: input.googleId,
                // Google has already verified it.
                emailVerified: true,
                avatarUrl: byEmail.avatarUrl ?? input.avatarUrl ?? null,
                lastLoginAt: new Date(),
            },
            include: { creatorProfile: true, workerProfile: true },
        });
        await auditAccount(linked.id, AuditAction.GOOGLE_LINKED, {
            entityType: "account",
            entityId: linked.id,
            metadata: { mergedByVerifiedEmail: true },
            context: input.context,
        });
        return { account: toPublicAccount(linked), ...issueToken(linked.id) };
    }
    const account = await prismaClient.account.create({
        data: {
            email,
            googleId: input.googleId,
            emailVerified: true,
            displayName: input.displayName ?? email.split("@")[0],
            avatarUrl: input.avatarUrl ?? null,
            signupProvider: AuthProvider.GOOGLE,
            lastLoginAt: new Date(),
        },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(account.id, AuditAction.ACCOUNT_REGISTERED, {
        entityType: "account",
        entityId: account.id,
        metadata: { provider: "GOOGLE" },
        context: input.context,
    });
    return { account: toPublicAccount(account), ...issueToken(account.id), isNewAccount: true };
}
// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
/**
 * The message a wallet must sign.
 *
 * Includes a nonce so a captured signature cannot be replayed, and states the
 * purpose so a user can see what they are approving.
 */
export function buildWalletChallenge(nonce, purpose) {
    const verb = purpose === "signin" ? "Sign in to DojoPay" : "Link this wallet to your DojoPay account";
    return `${verb}\n\nNonce: ${nonce}\n\nThis request will not trigger a transaction or cost any fees.`;
}
function verifyWalletSignature(walletAddress, message, signature) {
    if (!isValidPublicKey(walletAddress)) {
        throw badRequest("Invalid wallet address", "INVALID_PUBLIC_KEY");
    }
    let bytes;
    try {
        bytes = toSignatureBytes(signature);
    }
    catch {
        throw badRequest("Invalid signature format", "INVALID_SIGNATURE_FORMAT");
    }
    const verified = nacl.sign.detached.verify(new TextEncoder().encode(message), bytes, new PublicKey(walletAddress).toBytes());
    if (!verified)
        throw unauthorized("Wallet signature could not be verified", "INVALID_SIGNATURE");
}
/** Sign in or sign up with a wallet alone. No email required. */
export async function authenticateWithWallet(input) {
    verifyWalletSignature(input.walletAddress, buildWalletChallenge(input.nonce, "signin"), input.signature);
    const existing = await prismaClient.account.findUnique({
        where: { walletAddress: input.walletAddress },
        include: { creatorProfile: true, workerProfile: true },
    });
    if (existing) {
        assertUsable(existing);
        await prismaClient.account.update({
            where: { id: existing.id },
            data: { lastLoginAt: new Date() },
        });
        await auditAccount(existing.id, AuditAction.ACCOUNT_LOGIN, {
            metadata: { provider: "WALLET" },
            context: input.context,
        });
        return { account: toPublicAccount(existing), ...issueToken(existing.id) };
    }
    const account = await prismaClient.account.create({
        data: {
            walletAddress: input.walletAddress,
            walletLinkedAt: new Date(),
            displayName: `${input.walletAddress.slice(0, 4)}…${input.walletAddress.slice(-4)}`,
            signupProvider: AuthProvider.WALLET,
            referredBy: input.referredBy ?? null,
            lastLoginAt: new Date(),
        },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(account.id, AuditAction.ACCOUNT_REGISTERED, {
        entityType: "account",
        entityId: account.id,
        metadata: { provider: "WALLET", referredBy: input.referredBy ?? null },
        context: input.context,
    });
    return { account: toPublicAccount(account), ...issueToken(account.id), isNewAccount: true };
}
/**
 * Attach a wallet to an existing email/Google account.
 *
 * This is the gate on withdrawals: an account with no wallet has nowhere to
 * receive SOL.
 */
export async function linkWallet(accountId, input) {
    verifyWalletSignature(input.walletAddress, buildWalletChallenge(input.nonce, "link"), input.signature);
    const account = await loadAccount(accountId);
    if (account.walletAddress === input.walletAddress) {
        return toPublicAccount(account);
    }
    if (account.walletAddress) {
        throw conflict("This account already has a wallet linked. Unlink it first.", "WALLET_ALREADY_LINKED");
    }
    const taken = await prismaClient.account.findUnique({
        where: { walletAddress: input.walletAddress },
    });
    if (taken) {
        throw conflict("That wallet is already linked to another DojoPay account.", "WALLET_IN_USE");
    }
    const updated = await prismaClient.account.update({
        where: { id: accountId },
        data: { walletAddress: input.walletAddress, walletLinkedAt: new Date() },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(accountId, AuditAction.WALLET_LINKED, {
        entityType: "account",
        entityId: accountId,
        metadata: { walletAddress: input.walletAddress },
        context: input.context,
    });
    return toPublicAccount(updated);
}
/**
 * Detach a wallet.
 *
 * Refused while there is an unwithdrawn balance — otherwise the earnings have
 * no destination, and refused if it is the only credential, which would lock
 * the person out entirely.
 */
export async function unlinkWallet(accountId, context) {
    const account = await loadAccount(accountId);
    if (!account.walletAddress) {
        throw badRequest("No wallet is linked to this account", "NO_WALLET");
    }
    if (!account.passwordHash && !account.googleId) {
        throw badRequest("Add an email and password or connect Google before removing your wallet, " +
            "or you will not be able to sign in again.", "WALLET_IS_ONLY_CREDENTIAL");
    }
    if (account.workerProfile && account.workerProfile.pending_amount > 0n) {
        throw badRequest("Withdraw your pending earnings before unlinking your wallet.", "PENDING_BALANCE");
    }
    const updated = await prismaClient.account.update({
        where: { id: accountId },
        data: { walletAddress: null, walletLinkedAt: null },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(accountId, AuditAction.WALLET_UNLINKED, {
        entityType: "account",
        entityId: accountId,
        metadata: { previousWallet: account.walletAddress },
        context,
    });
    return toPublicAccount(updated);
}
/** Add email + password to a wallet-first account. */
export async function linkEmail(accountId, input) {
    const email = normaliseEmail(input.email);
    const account = await loadAccount(accountId);
    if (account.email) {
        throw conflict("This account already has an email address", "EMAIL_ALREADY_SET");
    }
    const weakness = validatePasswordStrength(input.password);
    if (weakness)
        throw badRequest(weakness, "WEAK_PASSWORD");
    const taken = await prismaClient.account.findUnique({ where: { email } });
    if (taken) {
        throw conflict("That email is already used by another account", "EMAIL_TAKEN");
    }
    const updated = await prismaClient.account.update({
        where: { id: accountId },
        data: {
            email,
            passwordHash: await hashPassword(input.password),
            emailVerified: false,
        },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(accountId, AuditAction.EMAIL_LINKED, {
        entityType: "account",
        entityId: accountId,
        metadata: { email },
        context: input.context,
    });
    await issueEmailVerification(accountId, email, input.context).catch((error) => logger.error("Verification email failed on link", {
        accountId,
        error: error instanceof Error ? error.message : String(error),
    }));
    return toPublicAccount(updated);
}
// ---------------------------------------------------------------------------
// Email verification and password reset
// ---------------------------------------------------------------------------
async function issueEmailVerification(accountId, email, context) {
    const { token, tokenHash } = generateToken();
    // Invalidate any outstanding verification tokens: only the newest link works.
    await prismaClient.verificationToken.updateMany({
        where: { account_id: accountId, type: TokenType.EMAIL_VERIFICATION, usedAt: null },
        data: { usedAt: new Date() },
    });
    await prismaClient.verificationToken.create({
        data: {
            account_id: accountId,
            tokenHash,
            type: TokenType.EMAIL_VERIFICATION,
            expiresAt: new Date(Date.now() + config.auth.emailTokenTtlMinutes * 60_000),
        },
    });
    await sendVerificationEmail(email, token);
    await auditAccount(accountId, AuditAction.EMAIL_VERIFICATION_SENT, {
        entityType: "account",
        entityId: accountId,
        context,
    });
}
export async function resendVerification(accountId, context) {
    const account = await loadAccount(accountId);
    if (!account.email)
        throw badRequest("No email on this account", "NO_EMAIL");
    if (account.emailVerified)
        throw badRequest("Email is already verified", "ALREADY_VERIFIED");
    await issueEmailVerification(accountId, account.email, context);
    return { message: "Verification email sent" };
}
export async function verifyEmail(token, context) {
    const record = await prismaClient.verificationToken.findUnique({
        where: { tokenHash: hashToken(token) },
    });
    if (!record || record.type !== TokenType.EMAIL_VERIFICATION) {
        throw badRequest("That verification link is not valid", "INVALID_TOKEN");
    }
    if (record.usedAt)
        throw badRequest("That link has already been used", "TOKEN_USED");
    if (record.expiresAt < new Date()) {
        throw badRequest("That link has expired — request a new one", "TOKEN_EXPIRED");
    }
    await prismaClient.$transaction([
        prismaClient.verificationToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        }),
        prismaClient.account.update({
            where: { id: record.account_id },
            data: { emailVerified: true },
        }),
    ]);
    await auditAccount(record.account_id, AuditAction.EMAIL_VERIFIED, {
        entityType: "account",
        entityId: record.account_id,
        context,
    });
    return { message: "Email verified" };
}
/**
 * Start a password reset.
 *
 * Always reports success. Unlike registration, this endpoint is unauthenticated
 * and trivially scriptable, so a truthful "no such account" would hand an
 * attacker a list of registered emails.
 */
export async function requestPasswordReset(email, context) {
    const normalised = normaliseEmail(email);
    const account = await prismaClient.account.findUnique({ where: { email: normalised } });
    if (account?.passwordHash || account?.email) {
        const { token, tokenHash } = generateToken();
        await prismaClient.verificationToken.updateMany({
            where: { account_id: account.id, type: TokenType.PASSWORD_RESET, usedAt: null },
            data: { usedAt: new Date() },
        });
        await prismaClient.verificationToken.create({
            data: {
                account_id: account.id,
                tokenHash,
                type: TokenType.PASSWORD_RESET,
                expiresAt: new Date(Date.now() + config.auth.emailTokenTtlMinutes * 60_000),
            },
        });
        await sendPasswordResetEmail(normalised, token).catch((error) => logger.error("Password reset email failed", {
            accountId: account.id,
            error: error instanceof Error ? error.message : String(error),
        }));
        await auditAccount(account.id, AuditAction.PASSWORD_RESET_REQUESTED, {
            entityType: "account",
            entityId: account.id,
            context,
        });
    }
    return { message: "If that email has an account, a reset link is on its way." };
}
export async function resetPassword(token, newPassword, context) {
    const weakness = validatePasswordStrength(newPassword);
    if (weakness)
        throw badRequest(weakness, "WEAK_PASSWORD");
    const record = await prismaClient.verificationToken.findUnique({
        where: { tokenHash: hashToken(token) },
    });
    if (!record || record.type !== TokenType.PASSWORD_RESET) {
        throw badRequest("That reset link is not valid", "INVALID_TOKEN");
    }
    if (record.usedAt)
        throw badRequest("That link has already been used", "TOKEN_USED");
    if (record.expiresAt < new Date()) {
        throw badRequest("That link has expired — request a new one", "TOKEN_EXPIRED");
    }
    await prismaClient.$transaction([
        prismaClient.verificationToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        }),
        prismaClient.account.update({
            where: { id: record.account_id },
            data: {
                passwordHash: await hashPassword(newPassword),
                // Completing a reset proves control of the inbox.
                emailVerified: true,
            },
        }),
    ]);
    await auditAccount(record.account_id, AuditAction.PASSWORD_RESET_COMPLETED, {
        entityType: "account",
        entityId: record.account_id,
        context,
    });
    return { message: "Password updated. You can sign in now." };
}
export async function changePassword(accountId, input) {
    const account = await loadAccount(accountId);
    const weakness = validatePasswordStrength(input.newPassword);
    if (weakness)
        throw badRequest(weakness, "WEAK_PASSWORD");
    // A Google-only account setting its first password has nothing to confirm
    // against; the session itself is the proof.
    if (account.passwordHash) {
        const valid = await verifyPassword(account.passwordHash, input.currentPassword);
        if (!valid)
            throw unauthorized("Current password is incorrect", "INVALID_CREDENTIALS");
    }
    await prismaClient.account.update({
        where: { id: accountId },
        data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await auditAccount(accountId, AuditAction.PASSWORD_CHANGED, {
        entityType: "account",
        entityId: accountId,
        context: input.context,
    });
    return { message: "Password updated" };
}
export async function updateProfile(accountId, input) {
    const updated = await prismaClient.account.update({
        where: { id: accountId },
        data: { ...(input.displayName ? { displayName: input.displayName.trim() } : {}) },
        include: { creatorProfile: true, workerProfile: true },
    });
    await auditAccount(accountId, AuditAction.PROFILE_UPDATED, {
        entityType: "account",
        entityId: accountId,
        metadata: { displayName: input.displayName },
        context: input.context,
    });
    return toPublicAccount(updated);
}
// ---------------------------------------------------------------------------
// Role profiles
// ---------------------------------------------------------------------------
/**
 * Get or create the creator profile for an account.
 *
 * Lazy so that signup never asks "which are you?" — the profile appears the
 * first time the account posts a task.
 */
export async function ensureCreatorProfile(accountId, context) {
    const existing = await prismaClient.user.findUnique({ where: { account_id: accountId } });
    if (existing)
        return existing;
    const profile = await prismaClient.user.create({ data: { account_id: accountId } });
    await auditAccount(accountId, AuditAction.CREATOR_PROFILE_CREATED, {
        entityType: "user",
        entityId: profile.id,
        context,
    });
    return profile;
}
export async function ensureWorkerProfile(accountId, context) {
    const existing = await prismaClient.worker.findUnique({ where: { account_id: accountId } });
    if (existing)
        return existing;
    const profile = await prismaClient.worker.create({
        data: { account_id: accountId, pending_amount: 0n, withdrawn_amount: 0n },
    });
    await auditAccount(accountId, AuditAction.WORKER_PROFILE_CREATED, {
        entityType: "worker",
        entityId: profile.id,
        context,
    });
    return profile;
}
//# sourceMappingURL=account.service.js.map