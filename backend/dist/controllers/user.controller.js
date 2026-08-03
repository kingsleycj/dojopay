import { createImageUploadUrl } from "../lib/s3.js";
import { signInCreator } from "../services/auth.service.js";
import * as analytics from "../services/analytics.service.js";
import * as tasks from "../services/task.service.js";
import { createTaskInput, signInInput, taskIdParam, updateTaskInput } from "../types/types.js";
import { badRequest, unauthorized } from "../utils/errors.js";
import { toJsonSafe } from "../utils/serialize.js";
/**
 * Creator HTTP handlers. These translate between HTTP and services and do
 * nothing else — no Prisma, no chain access, no business rules.
 */
function creatorId(req) {
    if (!req.userId)
        throw unauthorized();
    return req.userId;
}
export async function signin(req, res) {
    const { publicKey, signature } = signInInput.parse(req.body);
    const result = await signInCreator(publicKey, signature);
    res.json({ token: result.token });
}
export async function presignedUrl(req, res) {
    const { url, fields } = await createImageUploadUrl(creatorId(req));
    res.json({
        message: "Presigned URL generated successfully",
        presignedUrl: url,
        fields,
    });
}
export async function createTask(req, res) {
    const input = createTaskInput.parse(req.body);
    const task = await tasks.createTask(creatorId(req), input);
    res.status(201).json({ id: task.id });
}
export async function listTasks(req, res) {
    res.json({ tasks: await tasks.listCreatorTasks(creatorId(req)) });
}
export async function taskResults(req, res) {
    const taskId = Number(req.query.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
        throw badRequest("A valid taskId query parameter is required", "INVALID_TASK_ID");
    }
    res.json(toJsonSafe(await tasks.getTaskResults(creatorId(req), taskId)));
}
export async function getTask(req, res) {
    const { id } = taskIdParam.parse(req.params);
    const task = await tasks.getCreatorTask(creatorId(req), id);
    res.json(toJsonSafe({
        ...task,
        status: tasks.effectiveStatus(task),
        options: task.options,
        _count: { submissions: task.submissionCount },
    }));
}
export async function updateTask(req, res) {
    const { id } = taskIdParam.parse(req.params);
    const input = updateTaskInput.parse(req.body);
    const task = await tasks.updateTask(creatorId(req), id, input);
    res.json({ message: "Task updated successfully", task: toJsonSafe(task) });
}
export async function dashboard(req, res) {
    res.json(toJsonSafe(await analytics.getCreatorDashboard(creatorId(req))));
}
export async function earnings(req, res) {
    res.json(toJsonSafe(await analytics.getCreatorEarnings(creatorId(req))));
}
//# sourceMappingURL=user.controller.js.map