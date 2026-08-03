import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config/index.js";
import { logger } from "./logger.js";
let configured = false;
export function configurePassport() {
    if (configured)
        return passport;
    if (!config.google.enabled) {
        // Not fatal: the app runs fine without Google, the button is simply hidden.
        logger.warn("GOOGLE_CLIENT_ID/SECRET not set — Google sign-in is disabled");
        configured = true;
        return passport;
    }
    passport.use(new GoogleStrategy({
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        scope: ["profile", "email"],
    }, (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        // Without a verified email we cannot safely merge this identity with an
        // existing account, and cannot contact the user. Refuse rather than
        // create a half-account.
        if (!email) {
            return done(null, false, {
                message: "Your Google account did not share an email address",
            });
        }
        const result = {
            googleId: profile.id,
            email,
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
        };
        return done(null, result);
    }));
    configured = true;
    return passport;
}
export { passport };
//# sourceMappingURL=passport.js.map