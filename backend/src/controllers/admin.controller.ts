import type { Request, Response } from "express";
import { AccountStatus, ActorType, AuditSeverity, TaskStatus } from "@prisma/client";
import * as admin from "../services/admin.service.js";
import { accountTimeline, auditContextFrom, queryAuditLog } from "../services/audit.service.js";
import * as schemas from "../types/auth.types.js";
import { unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";

function adminId(req: Request): number {
  if (!req.admin) throw unauthorized();
  return req.admin.id;
}

// --- Auth -----------------------------------------------------------------

export async function loginStep1(req: Request, res: Response) {
  const input = schemas.adminLoginInput.parse(req.body);
  res.json(await admin.adminLoginStep1({ ...input, context: auditContextFrom(req) }));
}

export async function loginStep2(req: Request, res: Response) {
  const input = schemas.adminTotpInput.parse(req.body);
  res.json(await admin.adminLoginStep2({ ...input, context: auditContextFrom(req) }));
}

export async function enrollTotp(req: Request, res: Response) {
  const input = schemas.adminEnrollTotpInput.parse(req.body);
  res.json(await admin.adminEnrollTotp({ ...input, context: auditContextFrom(req) }));
}

export async function session(req: Request, res: Response) {
  res.json({ admin: req.admin });
}

// --- Overview -------------------------------------------------------------

export async function overview(_req: Request, res: Response) {
  res.json(toJsonSafe(await admin.getOverview()));
}

export async function growth(req: Request, res: Response) {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  res.json({ series: await admin.getGrowthSeries(days) });
}

// --- Accounts -------------------------------------------------------------

export async function listAccounts(req: Request, res: Response) {
  const query = schemas.adminAccountQuery.parse(req.query);
  res.json(
    toJsonSafe(
      await admin.listAccounts({
        ...query,
        status: query.status as AccountStatus | undefined,
      }),
    ),
  );
}

export async function accountDetail(req: Request, res: Response) {
  const { id } = schemas.idParam.parse(req.params);
  res.json(toJsonSafe(await admin.getAccountDetail(id, adminId(req))));
}

export async function accountActivity(req: Request, res: Response) {
  const { id } = schemas.idParam.parse(req.params);
  res.json(toJsonSafe({ entries: await accountTimeline(id) }));
}

export async function moderateAccount(req: Request, res: Response) {
  const { id } = schemas.idParam.parse(req.params);
  const input = schemas.adminModerateInput.parse(req.body);

  res.json(
    await admin.moderateAccount({
      accountId: id,
      adminId: adminId(req),
      action: input.action,
      reason: input.reason,
      context: auditContextFrom(req),
    }),
  );
}

// --- Tasks ----------------------------------------------------------------

export async function listTasks(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const status = req.query.status as TaskStatus | undefined;

  res.json(toJsonSafe(await admin.listTasks({ page, limit, status })));
}

export async function forceCloseTask(req: Request, res: Response) {
  const { id } = schemas.idParam.parse(req.params);
  const input = schemas.adminForceCloseTaskInput.parse(req.body);

  res.json(
    await admin.forceCloseTask({
      taskId: id,
      adminId: adminId(req),
      reason: input.reason,
      context: auditContextFrom(req),
    }),
  );
}

// --- Audit ----------------------------------------------------------------

export async function auditLog(req: Request, res: Response) {
  const query = schemas.adminAuditQuery.parse(req.query);

  res.json(
    toJsonSafe(
      await queryAuditLog({
        ...query,
        actorType: query.actorType as ActorType | undefined,
        severity: query.severity as AuditSeverity | undefined,
      }),
    ),
  );
}
