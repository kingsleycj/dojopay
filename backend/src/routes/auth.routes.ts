import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { requireAccount } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { authRateLimit, generalRateLimit } from "../middleware/rateLimit.js";
import { configurePassport } from "../lib/passport.js";
import { config } from "../config/index.js";

const router = Router();
const passport = configurePassport();

// --- Public ---------------------------------------------------------------

router.post("/register", authRateLimit, asyncHandler(controller.register));
router.post("/login", authRateLimit, asyncHandler(controller.login));

router.get("/wallet/challenge", generalRateLimit, asyncHandler(controller.walletChallenge));
router.post("/wallet", authRateLimit, asyncHandler(controller.walletAuth));

router.post("/verify-email", authRateLimit, asyncHandler(controller.verifyEmail));
router.post("/forgot-password", authRateLimit, asyncHandler(controller.forgotPassword));
router.post("/reset-password", authRateLimit, asyncHandler(controller.resetPassword));

router.get("/google/status", asyncHandler(controller.googleStatus));

// Registered only when configured — otherwise Passport throws "Unknown
// authentication strategy" on every request to these paths.
if (config.google.enabled) {
  router.get(
    "/google",
    authRateLimit,
    passport.authenticate("google", { session: false, scope: ["profile", "email"] }),
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${config.mail.appUrl}/auth/login?error=google_failed`,
    }),
    asyncHandler(controller.googleCallback),
  );
}

// --- Authenticated --------------------------------------------------------

router.use(asyncHandler(requireAccount));

router.get("/me", asyncHandler(controller.me));
router.post("/logout", asyncHandler(controller.logout));
router.patch("/profile", asyncHandler(controller.updateProfile));
router.post("/change-password", authRateLimit, asyncHandler(controller.changePassword));
router.post("/resend-verification", authRateLimit, asyncHandler(controller.resendVerification));

router.post("/link-email", authRateLimit, asyncHandler(controller.linkEmail));
router.post("/link-wallet", authRateLimit, asyncHandler(controller.linkWallet));
router.delete("/link-wallet", authRateLimit, asyncHandler(controller.unlinkWallet));

export default router;
