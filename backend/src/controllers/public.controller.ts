import type { Request, Response } from "express";
import { getPublicTask } from "../services/task.service.js";
import { taskIdParam } from "../types/types.js";
import { toJsonSafe } from "../utils/serialize.js";

/**
 * Unauthenticated endpoints backing share links.
 *
 * Someone opening a shared task link has no account yet, so this must work with
 * no token. The payload is deliberately minimal — enough to render a preview
 * and decide whether to sign up, and nothing that identifies other workers.
 */
export async function publicTask(req: Request, res: Response) {
  const { id } = taskIdParam.parse(req.params);
  const task = await getPublicTask(id);

  // Safe to cache briefly: this is the same for every visitor and share links
  // can arrive in bursts when a task is posted to a group chat.
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(toJsonSafe(task));
}
