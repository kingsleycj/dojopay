import * as payouts from "../services/payout.service.js";
import * as workers from "../services/worker.service.js";
import { createSubmissionInput, paginationInput, payoutInput } from "../types/types.js";
import { notFound, unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";
import { auditContextFrom } from "../services/audit.service.js";
function workerId(req) {
    if (!req.workerId)
        throw unauthorized();
    return req.workerId;
}
export async function nextTask(req, res) {
    const task = await workers.getNextTask(workerId(req));
    if (!task)
        throw notFound("No tasks available", "NO_TASKS_AVAILABLE");
    res.json(task);
}
export async function submit(req, res) {
    const { taskId, selection } = createSubmissionInput.parse(req.body);
    const id = workerId(req);
    const result = await workers.submitTask(id, taskId, selection, auditContextFrom(req));
    const next = await workers.getNextTask(id);
    res.json({
        message: "Submission successful",
        submissionId: result.submission.id,
        amount: result.reward.toString(),
        taskFull: result.taskFull,
        nextTask: next,
    });
}
export async function balance(req, res) {
    res.json(await workers.getWorkerBalance(workerId(req)));
}
export async function submissions(req, res) {
    res.json({ submissions: await workers.listWorkerSubmissions(workerId(req)) });
}
export async function payoutHistory(req, res) {
    res.json({ payouts: await payouts.listWorkerPayouts(workerId(req)) });
}
export async function earnings(req, res) {
    const { page, limit } = paginationInput.parse(req.query);
    res.json(toJsonSafe(await workers.getWorkerEarnings(workerId(req), page, limit)));
}
export async function dashboard(req, res) {
    res.json(toJsonSafe(await workers.getWorkerDashboard(workerId(req))));
}
export async function requestPayout(req, res) {
    const { signature } = payoutInput.parse(req.body);
    res.json(await payouts.requestPayout(workerId(req), signature, auditContextFrom(req)));
}
//# sourceMappingURL=worker.controller.js.map