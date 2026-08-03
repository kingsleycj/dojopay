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

/**
 * Lamport amounts cross the wire as strings.
 *
 * `Number` loses precision above 2^53 and JSON has no BigInt, so a numeric
 * amount would silently round at scale. Accepting only digits also rejects
 * `"1e9"`, `"0.5"` and `"-100"`, each of which `BigInt()` would either
 * mis-parse or throw on deep inside a service.
 */
const lamportString = z
  .string()
  .regex(/^\d+$/, "Amount must be a whole number of lamports, as a string");

export const createTaskInput = z.object({
  options: z
    .array(z.object({ imageUrl: z.string().min(1) }))
    .min(2, "A task needs at least two options to choose between")
    .max(20, "A task may have at most 20 options"),
  title: z.string().trim().min(1).max(200).optional(),
  /** Total lamports to commit. Bounds are enforced in `planBudget`. */
  budgetLamports: lamportString,
  /** How many answers the creator wants. */
  maxSubmissions: z.coerce.number().int().positive(),
  // `.nullish()` because the frontend sends `null` when the field is left blank.
  expirationDate: z.string().min(1).nullish(),
});

export const budgetQuoteInput = z.object({
  budgetLamports: lamportString,
  maxSubmissions: z.coerce.number().int().positive(),
});

export const uploadQuery = z.object({
  /**
   * Restricted to images. The value is signed into the upload URL, so anything
   * accepted here is what the object will be served as — an unconstrained value
   * would let a creator store `text/html` under the platform's own domain.
   */
  contentType: z
    .string()
    .regex(/^image\/[a-z0-9.+-]+$/i, "Only image uploads are supported")
    .default("image/jpeg"),
});

export const vaultDepositInput = z.object({
  /** Signature of the transfer that moved SOL into the platform wallet. */
  signature: z.string().min(1),
});

export const updatePreferencesInput = z
  .object({
    defaultMode: z.enum(["CREATOR", "WORKER"]).optional(),
    notifyTaskActivity: z.boolean().optional(),
    notifyPayouts: z.boolean().optional(),
    notifyProductNews: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one preference to update",
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

export type SignInInput = z.infer<typeof signInInput>;
export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionInput>;
export type PaginationInput = z.infer<typeof paginationInput>;
export type BudgetQuoteInput = z.infer<typeof budgetQuoteInput>;
export type VaultDepositInput = z.infer<typeof vaultDepositInput>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesInput>;
