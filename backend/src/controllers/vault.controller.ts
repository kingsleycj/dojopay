import type { Request, Response } from "express";
import * as vault from "../services/vault.service.js";
import { auditContextFrom } from "../services/audit.service.js";
import { paginationInput, vaultDepositInput, payoutInput } from "../types/types.js";
import { unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";

/**
 * Vault HTTP handlers.
 *
 * Keyed on the account rather than a role profile: a vault belongs to the
 * person, so the same balance is visible whichever surface they are looking at.
 */

function accountId(req: Request): number {
  if (!req.accountId) throw unauthorized();
  return req.accountId;
}

export async function summary(req: Request, res: Response) {
  res.json(toJsonSafe(await vault.getVaultSummary(accountId(req))));
}

export async function statement(req: Request, res: Response) {
  const { page, limit } = paginationInput.parse(req.query);
  res.json(toJsonSafe(await vault.listVaultEntries(accountId(req), page, limit)));
}

export async function deposit(req: Request, res: Response) {
  const { signature } = vaultDepositInput.parse(req.body);
  const updated = await vault.depositToVault(accountId(req), signature, auditContextFrom(req));
  res.status(201).json({ message: "Top-up credited", vault: toJsonSafe(updated) });
}

export async function withdraw(req: Request, res: Response) {
  const { signature } = payoutInput.parse(req.body);
  res.json(toJsonSafe(await vault.withdrawFromVault(accountId(req), signature, auditContextFrom(req))));
}
