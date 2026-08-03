import { Router } from "express";
import publicRoutes from "./public.routes.js";
import userRoutes from "./user.routes.js";
import workerRoutes from "./worker.routes.js";
const router = Router();
router.use("/user", userRoutes);
router.use("/worker", workerRoutes);
router.use("/public", publicRoutes);
export default router;
//# sourceMappingURL=index.js.map