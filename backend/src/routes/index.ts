import { Router } from "express";
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
// Separate prefix, separate JWT secret, separate credentials.
router.use("/admin", adminRoutes);

export default router;
