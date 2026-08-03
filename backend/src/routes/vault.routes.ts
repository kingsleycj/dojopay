import { Router } from "express";
import * as controller from "../controllers/vault.controller.js";
import { requireAccount, requireLinkedWallet } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { payoutRateLimit } from "../middleware/rateLimit.js";

const router = Router();

/**
 * Vault routes.
 *
 * Mounted on the account, not on a role. A vault belongs to the person, so the
 * balance a creator funds tasks from is the same one they see in settings and
 * the same one they withdraw from — there is no per-role copy to reconcile.
 */
router.use(asyncHandler(requireAccount));

router.get("/", asyncHandler(controller.summary));
router.get("/statement", asyncHandler(controller.statement));

/**
 * Both money-moving routes need a proven wallet, for opposite reasons: a deposit
 * must have come *from* one, and a withdrawal needs somewhere to go *to*.
 */
router.post("/deposit", payoutRateLimit, asyncHandler(requireLinkedWallet), asyncHandler(controller.deposit));
router.post("/withdraw", payoutRateLimit, asyncHandler(requireLinkedWallet), asyncHandler(controller.withdraw));

export default router;
