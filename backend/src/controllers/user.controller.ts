import type { Request, Response } from "express";
import { createImageUploadUrl } from "../lib/storage.js";
import * as analytics from "../services/analytics.service.js";
import * as tasks from "../services/task.service.js";
import {
  budgetQuoteInput,
  createTaskInput,
  taskIdParam,
  updateTaskInput,
  uploadQuery,
} from "../types/types.js";
import { badRequest, unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";
import { auditContextFrom } from "../services/audit.service.js";

/**
 * Creator HTTP handlers. These translate between HTTP and services and do
 * nothing else — no Prisma, no chain access, no business rules.
 */

function creatorId(req: Request): number {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function presignedUrl(req: Request, res: Response) {
  /**
   * The content type is part of what gets signed for R2, so the browser must
   * declare it up front and send the identical value on the PUT — a mismatch is
   * rejected as a signature failure, which reads as a mysterious 403.
   */
  const contentType = uploadQuery.parse(req.query).contentType;

  const upload = await createImageUploadUrl(creatorId(req), contentType);
  res.json({
    message: "Presigned URL generated successfully",
    presignedUrl: upload.url,
    key: upload.key,
    publicUrl: upload.publicUrl,
    maxBytes: upload.maxBytes,
    // Retained so an older deployed frontend keeps working during a rollout.
    fields: upload.fields,
  });
}

export async function createTask(req: Request, res: Response) {
  const input = createTaskInput.parse(req.body);
  const task = await tasks.createTask(creatorId(req), input, auditContextFrom(req));
  res.status(201).json({ id: task.id });
}

export async function listTasks(req: Request, res: Response) {
  res.json({ tasks: await tasks.listCreatorTasks(creatorId(req)) });
}

export async function taskResults(req: Request, res: Response) {
  const taskId = Number(req.query.taskId);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw badRequest("A valid taskId query parameter is required", "INVALID_TASK_ID");
  }
  res.json(toJsonSafe(await tasks.getTaskResults(creatorId(req), taskId)));
}

export async function getTask(req: Request, res: Response) {
  const { id } = taskIdParam.parse(req.params);
  const task = await tasks.getCreatorTask(creatorId(req), id);
  res.json(
    toJsonSafe({
      ...task,
      status: tasks.effectiveStatus(task),
      options: task.options,
      _count: { submissions: task.submissionCount },
    }),
  );
}

export async function updateTask(req: Request, res: Response) {
  const { id } = taskIdParam.parse(req.params);
  const input = updateTaskInput.parse(req.body);
  const task = await tasks.updateTask(creatorId(req), id, input);
  res.json({ message: "Task updated successfully", task: toJsonSafe(task) });
}

export async function cancelTask(req: Request, res: Response) {
  const { id } = taskIdParam.parse(req.params);
  res.json(toJsonSafe(await tasks.cancelTask(creatorId(req), id, auditContextFrom(req))));
}

export async function budgetQuote(req: Request, res: Response) {
  const { budgetLamports, maxSubmissions } = budgetQuoteInput.parse(req.query);
  res.json(tasks.quoteBudget(BigInt(budgetLamports), maxSubmissions));
}

export async function dashboard(req: Request, res: Response) {
  res.json(toJsonSafe(await analytics.getCreatorDashboard(creatorId(req))));
}

export async function earnings(req: Request, res: Response) {
  res.json(toJsonSafe(await analytics.getCreatorEarnings(creatorId(req))));
}
