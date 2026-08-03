import { Router } from "express";
import { isAdminEnabled } from "../config/index.js";
import adminRoutes from "./admin.routes.js";
import authRoutes from "./auth.routes.js";
import publicRoutes from "./public.routes.js";
import userRoutes from "./user.routes.js";
import workerRoutes from "./worker.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/worker", workerRoutes);
router.use("/public", publicRoutes);

/**
 * Admin: separate prefix, separate JWT secret, separate credentials.
 *
 * Mounted only when `ADMIN_JWT_SECRET` is configured and differs from the user
 * secret. An unconfigured deployment therefore 404s these routes rather than
 * serving them with a weak or shared secret.
 */
if (isAdminEnabled()) {
  router.use("/admin", adminRoutes);
}

export default router;
