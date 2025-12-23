import z from 'zod'

export const createTaskInput = z.object({
    options: z.array(z.object({
        imageUrl: z.string(),
    })),
    title: z.string().optional(),
    signature: z.string(),
    expirationDate: z.string().optional(), // ISO date string for expiration
})

export const createSubmissionInput = z.object({
    taskId: z.string(),
    selection: z.string(),
})