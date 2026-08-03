import argon2 from "argon2";
import crypto from "node:crypto";
/**
 * Password hashing and single-use token generation.
 *
 * Argon2id rather than bcrypt: it is the current OWASP recommendation and
 * resists GPU cracking far better. Parameters follow the OWASP minimum for
 * argon2id (19 MiB, 2 iterations, 1 degree of parallelism).
 */
const ARGON_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
};
export function hashPassword(password) {
    // `raw: false` (the default) returns the encoded string form, which carries
    // the parameters and salt with it — so raising the cost later does not
    // invalidate existing hashes.
    return argon2.hash(password, { ...ARGON_OPTIONS, raw: false });
}
export async function verifyPassword(hash, password) {
    try {
        return await argon2.verify(hash, password);
    }
    catch {
        // A malformed hash must read as "wrong password", never as a crash that
        // leaks which accounts have unusable credentials.
        return false;
    }
}
/**
 * Dummy verify used when an email does not exist.
 *
 * Without it, "no such account" returns in ~1ms while a real account takes the
 * full argon2 cost, and that timing difference enumerates registered emails.
 */
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$JXPxYlEJv8nHqLKvJj4kZ9dGxJKGvKZJhCJvY0Xy1sA";
export async function fakeVerifyForTiming() {
    await verifyPassword(DUMMY_HASH, "timing-equaliser");
}
/**
 * Generate a URL-safe token plus the hash to store.
 *
 * Only the hash goes in the database: a leaked dump must not hand anyone a
 * working password-reset link.
 */
export function generateToken() {
    const token = crypto.randomBytes(32).toString("base64url");
    return { token, tokenHash: hashToken(token) };
}
export function hashToken(token) {
    // SHA-256 is right here, unlike for passwords: the input already has 256 bits
    // of entropy, so there is nothing to brute-force and lookups must be fast.
    return crypto.createHash("sha256").update(token).digest("hex");
}
/** Constant-time string comparison for anything secret. */
export function safeEqual(a, b) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length)
        return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
}
/**
 * Password policy.
 *
 * Length over composition rules: NIST dropped the mandatory-symbol guidance
 * because it pushes people toward `Password1!` and reuse.
 */
export function validatePasswordStrength(password) {
    if (password.length < 10)
        return "Password must be at least 10 characters";
    if (password.length > 200)
        return "Password must be at most 200 characters";
    if (/^\d+$/.test(password))
        return "Password cannot be only numbers";
    const common = ["password", "12345678", "qwerty", "letmein", "dojopay", "solana"];
    const lowered = password.toLowerCase();
    if (common.some((entry) => lowered.includes(entry))) {
        return "Password is too easy to guess";
    }
    return null;
}
//# sourceMappingURL=password.js.map