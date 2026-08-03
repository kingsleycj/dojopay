import crypto from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config/index.js";
import * as accounts from "../services/account.service.js";
import { auditAccount, auditContextFrom, AuditAction } from "../services/audit.service.js";
import * as schemas from "../types/auth.types.js";
import { updatePreferencesInput } from "../types/types.js";
import { unauthorized } from "../utils/errors.js";

/**
 * Authentication endpoints.
 *
 * Every path — email, Google, wallet — ends at the same account JWT, so the
 * rest of the API does not care how someone signed in.
 */

function accountId(req: Request): number {
  if (!req.accountId) throw unauthorized();
  return req.accountId;
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

export async function register(req: Request, res: Response) {
  const input = schemas.registerInput.parse(req.body);
  const result = await accounts.registerWithEmail({
    ...input,
    context: auditContextFrom(req),
  });
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = schemas.loginInput.parse(req.body);
  const result = await accounts.loginWithEmail({ ...input, context: auditContextFrom(req) });
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  // Tokens are stateless, so this only records the intent — the client discards
  // the token. A revocation list would be the next step if that is not enough.
  await auditAccount(req.accountId, AuditAction.ACCOUNT_LOGOUT, {
    context: auditContextFrom(req),
  });
  res.json({ message: "Signed out" });
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

/**
 * Issue a nonce for the wallet to sign.
 *
 * The nonce is embedded in the signed message, so a signature captured from one
 * sign-in cannot be replayed later. It is returned to the client rather than
 * stored: the signature is verified against the message the client echoes back,
 * and single use is enforced by the short expiry baked into the token.
 */
export async function walletChallenge(req: Request, res: Response) {
  const { purpose } = schemas.walletChallengeInput.parse(req.query);
  const nonce = crypto.randomBytes(16).toString("hex");

  res.json({
    nonce,
    message: accounts.buildWalletChallenge(nonce, purpose),
  });
}

export async function walletAuth(req: Request, res: Response) {
  const input = schemas.walletAuthInput.parse(req.body);
  const result = await accounts.authenticateWithWallet({
    ...input,
    context: auditContextFrom(req),
  });
  res.json(result);
}

export async function linkWallet(req: Request, res: Response) {
  const input = schemas.linkWalletInput.parse(req.body);
  const account = await accounts.linkWallet(accountId(req), {
    ...input,
    context: auditContextFrom(req),
  });
  res.json({ account });
}

export async function unlinkWallet(req: Request, res: Response) {
  const account = await accounts.unlinkWallet(accountId(req), auditContextFrom(req));
  res.json({ account });
}

// ---------------------------------------------------------------------------
// Account management
// ---------------------------------------------------------------------------

export async function me(req: Request, res: Response) {
  const account = await accounts.getAccount(accountId(req));
  res.json({ account: accounts.toPublicAccount(account) });
}

export async function linkEmail(req: Request, res: Response) {
  const input = schemas.linkEmailInput.parse(req.body);
  const account = await accounts.linkEmail(accountId(req), {
    ...input,
    context: auditContextFrom(req),
  });
  res.json({ account });
}

export async function updateProfile(req: Request, res: Response) {
  const input = schemas.updateProfileInput.parse(req.body);
  const account = await accounts.updateProfile(accountId(req), {
    ...input,
    context: auditContextFrom(req),
  });
  res.json({ account });
}

export async function updatePreferences(req: Request, res: Response) {
  const input = updatePreferencesInput.parse(req.body);
  const account = await accounts.updatePreferences(accountId(req), input, auditContextFrom(req));
  res.json({ account });
}

export async function changePassword(req: Request, res: Response) {
  const input = schemas.changePasswordInput.parse(req.body);
  res.json(
    await accounts.changePassword(accountId(req), {
      ...input,
      context: auditContextFrom(req),
    }),
  );
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = schemas.tokenInput.parse(req.body);
  res.json(await accounts.verifyEmail(token, auditContextFrom(req)));
}

export async function resendVerification(req: Request, res: Response) {
  res.json(await accounts.resendVerification(accountId(req), auditContextFrom(req)));
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = schemas.forgotPasswordInput.parse(req.body);
  res.json(await accounts.requestPasswordReset(email, auditContextFrom(req)));
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = schemas.resetPasswordInput.parse(req.body);
  res.json(await accounts.resetPassword(token, password, auditContextFrom(req)));
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/**
 * OAuth callback landing.
 *
 * Redirects back to the frontend with the token in the fragment rather than the
 * query string: fragments are not sent to servers and do not end up in access
 * logs or `Referer` headers.
 */
export async function googleCallback(req: Request, res: Response) {
  const profile = req.user as
    | { googleId: string; email: string; displayName?: string; avatarUrl?: string }
    | undefined;

  if (!profile) {
    return res.redirect(`${config.mail.appUrl}/auth/login?error=google_failed`);
  }

  const result = await accounts.upsertGoogleAccount({
    ...profile,
    context: auditContextFrom(req),
  });

  const params = new URLSearchParams({ token: result.token });
  if (result.isNewAccount) params.set("welcome", "1");

  res.redirect(`${config.mail.appUrl}/auth/callback#${params.toString()}`);
}

export async function googleStatus(_req: Request, res: Response) {
  // Lets the frontend hide the Google button when it is not configured.
  res.json({ enabled: config.google.enabled });
}
