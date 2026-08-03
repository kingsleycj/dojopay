import { Router } from "express";
import * as controller from "../controllers/worker.controller.js";
import { requireAccount, requireLinkedWallet, requireWorker } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { payoutRateLimit } from "../middleware/rateLimit.js";
const router = Router();
/**
 * Worker routes.
 *
 * Sign-in lives at `/v1/auth`. `requireWorker` resolves (and lazily creates) the
 * worker profile, so someone who signed up with an email becomes a worker simply
 * by opening a task.
 */
router.use(asyncHandler(requireAccount), asyncHandler(requireWorker));
router.get("/nextTask", asyncHandler(controller.nextTask));
router.post("/submission", asyncHandler(controller.submit));
router.get("/balance", asyncHandler(controller.balance));
router.get("/submissions", asyncHandler(controller.submissions));
router.get("/payouts", asyncHandler(controller.payoutHistory));
router.get("/earnings", asyncHandler(controller.earnings));
router.get("/dashboard", asyncHandler(controller.dashboard));
// The wallet gate: earning needs only an email, but SOL needs somewhere to go.
router.post("/payout", payoutRateLimit, asyncHandler(requireLinkedWallet), asyncHandler(controller.requestPayout));
export default router;
//# sourceMappingURL=worker.routes.js.map