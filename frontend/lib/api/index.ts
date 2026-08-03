import { creatorApi, publicApi, workerApi } from "./client";
import type {
  CreatorDashboard,
  CreatorEarnings,
  CreatorTask,
  PublicTask,
  TaskResults,
  WorkerBalance,
  WorkerDashboard,
  WorkerEarnings,
  WorkerTask,
} from "./types";

/**
 * Typed endpoint functions. Components call these; they never touch axios.
 */

export const authApi = {
  signInCreator: (publicKey: string, signature: number[]) =>
    publicApi
      .post<{ token: string }>("/v1/user/signin", { publicKey, signature })
      .then((r) => r.data),

  signInWorker: (publicKey: string, signature: number[], referredBy?: string | null) =>
    publicApi
      .post<{ token: string; pendingAmount: string; isNewWorker: boolean }>(
        "/v1/worker/signin",
        { publicKey, signature, referredBy: referredBy ?? undefined },
      )
      .then((r) => r.data),
};

export const creatorEndpoints = {
  listTasks: () =>
    creatorApi.get<{ tasks: CreatorTask[] }>("/v1/user/tasks").then((r) => r.data.tasks),

  getTask: (taskId: number) =>
    creatorApi.get<CreatorTask>(`/v1/user/task/${taskId}`).then((r) => r.data),

  getTaskResults: (taskId: number) =>
    creatorApi.get<TaskResults>("/v1/user/task", { params: { taskId } }).then((r) => r.data),

  createTask: (payload: {
    options: Array<{ imageUrl: string }>;
    title: string;
    signature: string;
    expirationDate?: string | null;
  }) => creatorApi.post<{ id: number }>("/v1/user/task", payload).then((r) => r.data),

  updateTask: (taskId: number, payload: { title?: string; expirationDate?: string | null }) =>
    creatorApi.patch(`/v1/user/task/${taskId}`, payload).then((r) => r.data),

  dashboard: () => creatorApi.get<CreatorDashboard>("/v1/user/dashboard").then((r) => r.data),

  earnings: () => creatorApi.get<CreatorEarnings>("/v1/user/earnings").then((r) => r.data),

  presignedUrl: () =>
    creatorApi
      .get<{ presignedUrl: string; fields: Record<string, string> }>("/v1/user/presignedUrl")
      .then((r) => r.data),
};

export const workerEndpoints = {
  nextTask: () =>
    workerApi
      .get<WorkerTask>("/v1/worker/nextTask")
      .then((r) => r.data)
      // 404 here means "nothing available", which is a normal state, not an error.
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      }),

  submit: (taskId: number, selection: number) =>
    workerApi
      .post<{
        message: string;
        submissionId: number;
        amount: string;
        taskFull: boolean;
        nextTask: WorkerTask | null;
      }>("/v1/worker/submission", { taskId, selection })
      .then((r) => r.data),

  balance: () => workerApi.get<WorkerBalance>("/v1/worker/balance").then((r) => r.data),

  submissions: () =>
    workerApi
      .get<{ submissions: Array<Record<string, unknown>> }>("/v1/worker/submissions")
      .then((r) => r.data.submissions),

  dashboard: () => workerApi.get<WorkerDashboard>("/v1/worker/dashboard").then((r) => r.data),

  earnings: (page = 1, limit = 4) =>
    workerApi
      .get<WorkerEarnings>("/v1/worker/earnings", { params: { page, limit } })
      .then((r) => r.data),

  /**
   * Withdraw. `signature` is the wallet's signature over the message from
   * `buildWithdrawalMessage` — the backend rejects a request without it, which
   * is why the old earnings page (which sent an empty body) always failed.
   */
  payout: (signature: number[]) =>
    workerApi
      .post<{ message: string; signature: string; amount: string }>("/v1/worker/payout", {
        signature,
      })
      .then((r) => r.data),
};

export const publicEndpoints = {
  task: (taskId: number) =>
    publicApi.get<PublicTask>(`/v1/public/task/${taskId}`).then((r) => r.data),
};

/** Message a worker signs to authorise a withdrawal. Must match the backend byte for byte. */
export function buildWithdrawalMessage(lamports: string, address: string): string {
  return `Withdraw ${lamports} lamports to ${address}`;
}

export * from "./types";
export { ApiError, BACKEND_URL, clearTokens, getToken, setToken } from "./client";
