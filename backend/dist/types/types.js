import { z } from "zod";
/**
 * Request schemas. Every controller parses its input through one of these —
 * the old code validated task creation but took `taskId`, `selection`, titles
 * and expiry dates straight off the body elsewhere.
 */
/** Wallet signatures arrive in several shapes depending on adapter version. */
const signatureSchema = z.union([
    z.string().min(1),
    z.array(z.number().int().min(0).max(255)),
    z.object({ data: z.array(z.number().int().min(0).max(255)) }),
]);
export const signInInput = z.object({
    publicKey: z.string().min(32).max(44),
    signature: signatureSchema,
    /** Wallet address that shared the link that brought this worker in. */
    referredBy: z.string().min(32).max(44).nullish(),
});
export const createTaskInput = z.object({
    options: z
        .array(z.object({ imageUrl: z.string().min(1) }))
        .min(2, "A task needs at least two options to choose between")
        .max(20, "A task may have at most 20 options"),
    title: z.string().trim().min(1).max(200).optional(),
    signature: z.string().min(1),
    // `.nullish()` because the frontend sends `null` when the field is left blank.
    expirationDate: z.string().min(1).nullish(),
});
export const updateTaskInput = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    expirationDate: z.string().min(1).nullish(),
});
export const createSubmissionInput = z.object({
    taskId: z.coerce.number().int().positive(),
    selection: z.coerce.number().int().positive(),
});
export const payoutInput = z.object({
    signature: signatureSchema,
});
export const paginationInput = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(4),
});
export const taskIdParam = z.object({
    id: z.coerce.number().int().positive(),
});
//# sourceMappingURL=types.js.map