import { generateSecret, generateURI, verifySync } from "otplib";
/**
 * TOTP for admin two-factor auth.
 *
 * Wrapped rather than used directly so the otplib v13 functional API is pinned
 * in one place — the option shape changed substantially from v12, and every
 * call site should not have to know that.
 */
const ISSUER = "DojoPay Admin";
/**
 * Accept codes one 30-second step either side of now.
 *
 * A phone clock is rarely exact, and a zero-tolerance window locks staff out
 * for reasons they cannot diagnose. One step is the standard compromise.
 */
const EPOCH_TOLERANCE_SECONDS = 30;
export function createTotpSecret() {
    return generateSecret();
}
/** `otpauth://` URI for the QR code shown during enrolment. */
export function buildTotpUri(secret, accountLabel) {
    return generateURI({
        strategy: "totp",
        issuer: ISSUER,
        label: accountLabel,
        secret,
    });
}
export function verifyTotp(secret, token) {
    try {
        const result = verifySync({
            strategy: "totp",
            secret,
            token,
            epochTolerance: EPOCH_TOLERANCE_SECONDS,
        });
        return result.valid === true;
    }
    catch {
        // A malformed secret or token reads as "wrong code", not a 500.
        return false;
    }
}
//# sourceMappingURL=totp.js.map