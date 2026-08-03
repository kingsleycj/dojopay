import { z } from "zod";
/**
 * Wallet signatures arrive in several shapes depending on adapter version.
 * Typed as `unknown` on the way out because the normaliser in `lib/solana`
 * owns the discrimination — the schema's job here is only to reject absence.
 */
const signatureSchema = z.union([
    z.string().min(1),
    z.array(z.number().int().min(0).max(255)),
    z.object({ data: z.array(z.number().int().min(0).max(255)) }),
]);
const walletAddressSchema = z.string().min(32).max(44);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z.string().min(1, "Password is required").max(200);
export const registerInput = z.object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(1).max(80).optional(),
    referredBy: walletAddressSchema.nullish(),
});
export const loginInput = z.object({
    email: emailSchema,
    password: passwordSchema,
});
export const walletChallengeInput = z.object({
    purpose: z.enum(["signin", "link"]).default("signin"),
});
export const walletAuthInput = z.object({
    walletAddress: walletAddressSchema,
    signature: signatureSchema,
    nonce: z.string().min(8).max(128),
    referredBy: walletAddressSchema.nullish(),
});
export const linkWalletInput = z.object({
    walletAddress: walletAddressSchema,
    signature: signatureSchema,
    nonce: z.string().min(8).max(128),
});
export const linkEmailInput = z.object({
    email: emailSchema,
    password: passwordSchema,
});
export const updateProfileInput = z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
});
export const changePasswordInput = z.object({
    // Empty when a Google-only account is setting its first password.
    currentPassword: z.string().max(200).default(""),
    newPassword: passwordSchema,
});
export const tokenInput = z.object({
    token: z.string().min(10).max(200),
});
export const forgotPasswordInput = z.object({
    email: emailSchema,
});
export const resetPasswordInput = z.object({
    token: z.string().min(10).max(200),
    password: passwordSchema,
});
// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminLoginInput = z.object({
    email: emailSchema,
    password: passwordSchema,
});
export const adminTotpInput = z.object({
    /** Short-lived token from the password step. */
    challengeToken: z.string().min(10),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});
export const adminEnrollTotpInput = z.object({
    challengeToken: z.string().min(10),
    code: z.string().regex(/^\d{6}$/),
});
export const adminAccountQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(25),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
    provider: z.enum(["EMAIL", "GOOGLE", "WALLET"]).optional(),
    sort: z.enum(["newest", "oldest", "lastActive"]).default("newest"),
});
export const adminAuditQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    action: z.string().trim().max(60).optional(),
    actorType: z.enum(["ACCOUNT", "ADMIN", "SYSTEM"]).optional(),
    severity: z.enum(["INFO", "NOTICE", "WARNING", "CRITICAL"]).optional(),
    accountId: z.coerce.number().int().positive().optional(),
    adminId: z.coerce.number().int().positive().optional(),
    entityType: z.string().trim().max(40).optional(),
    entityId: z.string().trim().max(40).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
});
export const adminModerateInput = z.object({
    reason: z.string().trim().min(5, "Give a reason — it is recorded and shown to the user").max(500),
    /** Suspended accounts can be reactivated; banned ones cannot. */
    action: z.enum(["SUSPEND", "BAN", "REACTIVATE"]),
});
export const adminForceCloseTaskInput = z.object({
    reason: z.string().trim().min(5).max(500),
});
export const idParam = z.object({
    id: z.coerce.number().int().positive(),
});
//# sourceMappingURL=auth.types.js.map