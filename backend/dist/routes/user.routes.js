import { Router } from "express";
import * as controller from "../controllers/user.controller.js";
import { requireAccount, requireCreator } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { taskCreationRateLimit } from "../middleware/rateLimit.js";
const router = Router();
/**
 * Creator routes.
 *
 * Sign-in lives at `/v1/auth` now — there is one session per person, not one
 * per role. `requireCreator` resolves (and lazily creates) the creator profile
 * for the signed-in account, so becoming a creator is simply posting a task.
 */
router.use(asyncHandler(requireAccount), asyncHandler(requireCreator));
router.get("/presignedUrl", asyncHandler(controller.presignedUrl));
router.post("/task", taskCreationRateLimit, asyncHandler(controller.createTask));
router.get("/tasks", asyncHandler(controller.listTasks));
router.get("/dashboard", asyncHandler(controller.dashboard));
router.get("/earnings", asyncHandler(controller.earnings));
// `/task?taskId=` must be declared before `/task/:id`, or Express matches the
// parameterised route first and `taskId` is silently ignored.
router.get("/task", asyncHandler(controller.taskResults));
router.get("/task/:id", asyncHandler(controller.getTask));
// PATCH is canonical; PUT is retained because the deployed frontend still calls
// it. Both share one handler rather than being byte-identical duplicates.
router.patch("/task/:id", asyncHandler(controller.updateTask));
router.put("/task/:id", asyncHandler(controller.updateTask));
export default router;
//# sourceMappingURL=user.routes.js.map