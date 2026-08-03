import { Router } from "express";
import * as controller from "../controllers/worker.controller.js";
import { requireWorker } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { authRateLimit, payoutRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/signin", authRateLimit, asyncHandler(controller.signin));

// Everything below requires a worker token. The old router had an
// unauthenticated `/test-earnings` debug endpoint hardcoded to worker 1 sitting
// among these; it has been deleted.
router.use(requireWorker);

router.get("/nextTask", asyncHandler(controller.nextTask));
router.post("/submission", asyncHandler(controller.submit));
router.get("/balance", asyncHandler(controller.balance));
router.get("/submissions", asyncHandler(controller.submissions));
router.get("/payouts", asyncHandler(controller.payoutHistory));
router.get("/earnings", asyncHandler(controller.earnings));
router.get("/dashboard", asyncHandler(controller.dashboard));
router.post("/payout", payoutRateLimit, asyncHandler(controller.requestPayout));

export default router;
