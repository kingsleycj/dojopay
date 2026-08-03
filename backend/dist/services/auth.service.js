import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
import { config } from "../config/index.js";
import { prismaClient } from "../lib/prisma.js";
import { isValidPublicKey, toSignatureBytes } from "../lib/solana.js";
import { badRequest, unauthorized } from "../utils/errors.js";
/**
 * Wallet-signature authentication.
 *
 * The client signs a fixed message; we verify it against the claimed public key
 * and issue a JWT. Creators and workers are distinct identities with distinct
 * secrets — see CLAUDE.md §4.
 */
function verifySignature(publicKey, signature, message) {
    if (!isValidPublicKey(publicKey)) {
        throw badRequest("Invalid public key", "INVALID_PUBLIC_KEY");
    }
    let signatureBytes;
    try {
        signatureBytes = toSignatureBytes(signature);
    }
    catch {
        throw badRequest("Invalid signature format", "INVALID_SIGNATURE_FORMAT");
    }
    const messageBytes = new TextEncoder().encode(message);
    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, new PublicKey(publicKey).toBytes());
    if (!verified)
        throw unauthorized("Incorrect signature", "INVALID_SIGNATURE");
}
export async function signInCreator(publicKey, signature) {
    verifySignature(publicKey, signature, config.auth.creatorSignInMessage);
    const user = await prismaClient.user.upsert({
        where: { address: publicKey },
        update: {},
        create: { address: publicKey },
    });
    const token = jwt.sign({ userId: user.id }, config.auth.jwtSecret, { expiresIn: "7d" });
    return { token, userId: user.id };
}
export async function signInWorker(publicKey, signature, referredBy) {
    verifySignature(publicKey, signature, config.auth.workerSignInMessage);
    const existing = await prismaClient.worker.findUnique({ where: { address: publicKey } });
    const worker = existing ??
        (await prismaClient.worker.create({
            data: {
                address: publicKey,
                pending_amount: 0n,
                withdrawn_amount: 0n,
                // Attribution is recorded once, at creation — a returning worker cannot
                // be re-attributed by opening someone else's share link.
                referred_by: referredBy && referredBy !== publicKey ? referredBy : null,
            },
        }));
    const token = jwt.sign({ workerId: worker.id }, config.auth.workerJwtSecret, { expiresIn: "7d" });
    return {
        token,
        workerId: worker.id,
        pendingAmount: worker.pending_amount.toString(),
        isNewWorker: existing === null,
    };
}
//# sourceMappingURL=auth.service.js.map