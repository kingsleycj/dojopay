import { Router } from "express";
import { AdminRole } from "@prisma/client";
import * as controller from "../controllers/admin.controller.js";
import { requireAdmin, requireAdminRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { rateLimit } from "../middleware/rateLimit.js";
const router = Router();
/**
 * Staff API, mounted at `/v1/admin`.
 *
 * There is no registration route — the first OWNER is created by
 * `npm run admin:create` against the database, and further admins only by an
 * existing OWNER. Login is two-step and always ends in TOTP.
 */
// Tighter than the user auth limit: this endpoint guards everyone's data.
const adminLoginLimit = rateLimit({ name: "admin-login", windowMs: 15 * 60_000, max: 5 });
router.post("/auth/login", adminLoginLimit, asyncHandler(controller.loginStep1));
router.post("/auth/verify", adminLoginLimit, asyncHandler(controller.loginStep2));
router.post("/auth/enroll", adminLoginLimit, asyncHandler(controller.enrollTotp));
router.use(asyncHandler(requireAdmin));
router.get("/session", asyncHandler(controller.session));
// Read — available to every role including ANALYST.
router.get("/overview", asyncHandler(controller.overview));
router.get("/growth", asyncHandler(controller.growth));
router.get("/accounts", asyncHandler(controller.listAccounts));
router.get("/accounts/:id", asyncHandler(controller.accountDetail));
router.get("/accounts/:id/activity", asyncHandler(controller.accountActivity));
router.get("/tasks", asyncHandler(controller.listTasks));
router.get("/audit", asyncHandler(controller.auditLog));
// Moderation — ANALYST can look but not touch.
router.post("/accounts/:id/moderate", requireAdminRole(AdminRole.OWNER, AdminRole.ADMIN), asyncHandler(controller.moderateAccount));
router.post("/tasks/:id/force-close", requireAdminRole(AdminRole.OWNER, AdminRole.ADMIN), asyncHandler(controller.forceCloseTask));
export default router;
//# sourceMappingURL=admin.routes.js.map