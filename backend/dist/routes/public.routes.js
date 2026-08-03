import { Router } from "express";
import * as controller from "../controllers/public.controller.js";
import { asyncHandler } from "../middleware/error.js";
import { generalRateLimit } from "../middleware/rateLimit.js";
const router = Router();
router.get("/task/:id", generalRateLimit, asyncHandler(controller.publicTask));
export default router;
//# sourceMappingURL=public.routes.js.map