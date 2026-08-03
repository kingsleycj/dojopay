import type { Request, Response } from "express";
import { signInWorker } from "../services/auth.service.js";
import * as payouts from "../services/payout.service.js";
import * as workers from "../services/worker.service.js";
import { createSubmissionInput, paginationInput, payoutInput, signInInput } from "../types/types.js";
import { notFound, unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";

function workerId(req: Request): number {
  if (!req.workerId) throw unauthorized();
  return req.workerId;
}

export async function signin(req: Request, res: Response) {
  const { publicKey, signature, referredBy } = signInInput.parse(req.body);
  const result = await signInWorker(publicKey, signature, referredBy ?? undefined);

  res.json({
    token: result.token,
    pendingAmount: result.pendingAmount,
    isNewWorker: result.isNewWorker,
  });
}

export async function nextTask(req: Request, res: Response) {
  const task = await workers.getNextTask(workerId(req));
  if (!task) throw notFound("No tasks available", "NO_TASKS_AVAILABLE");
  res.json(task);
}

export async function submit(req: Request, res: Response) {
  const { taskId, selection } = createSubmissionInput.parse(req.body);
  const id = workerId(req);

  const result = await workers.submitTask(id, taskId, selection);
  const next = await workers.getNextTask(id);

  res.json({
    message: "Submission successful",
    submissionId: result.submission.id,
    amount: result.reward.toString(),
    taskFull: result.taskFull,
    nextTask: next,
  });
}

export async function balance(req: Request, res: Response) {
  res.json(await workers.getWorkerBalance(workerId(req)));
}

export async function submissions(req: Request, res: Response) {
  res.json({ submissions: await workers.listWorkerSubmissions(workerId(req)) });
}

export async function payoutHistory(req: Request, res: Response) {
  res.json({ payouts: await payouts.listWorkerPayouts(workerId(req)) });
}

export async function earnings(req: Request, res: Response) {
  const { page, limit } = paginationInput.parse(req.query);
  res.json(toJsonSafe(await workers.getWorkerEarnings(workerId(req), page, limit)));
}

export async function dashboard(req: Request, res: Response) {
  res.json(toJsonSafe(await workers.getWorkerDashboard(workerId(req))));
}

export async function requestPayout(req: Request, res: Response) {
  const { signature } = payoutInput.parse(req.body);
  res.json(await payouts.requestPayout(workerId(req), signature));
}
