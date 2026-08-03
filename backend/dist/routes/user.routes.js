import { Router } from "express";
import * as controller from "../controllers/user.controller.js";
import { requireCreator } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { authRateLimit, taskCreationRateLimit } from "../middleware/rateLimit.js";
const router = Router();
router.post("/signin", authRateLimit, asyncHandler(controller.signin));
router.use(requireCreator);
router.get("/presignedUrl", asyncHandler(controller.presignedUrl));
router.post("/task", taskCreationRateLimit, asyncHandler(controller.createTask));
router.get("/tasks", asyncHandler(controller.listTasks));
router.get("/dashboard", asyncHandler(controller.dashboard));
router.get("/earnings", asyncHandler(controller.earnings));
// `/task?taskId=` must be declared before `/task/:id`, or Express matches the
// parameterised route first and `taskId` is silently ignored.
router.get("/task", asyncHandler(controller.taskResults));
router.get("/task/:id", asyncHandler(controller.getTask));
// PATCH is the canonical verb. PUT is retained only because the deployed
// frontend still calls it; both now share one handler rather than being
// byte-identical duplicates.
router.patch("/task/:id", asyncHandler(controller.updateTask));
router.put("/task/:id", asyncHandler(controller.updateTask));
export default router;
//# sourceMappingURL=user.routes.js.map