import { adminApi, api, BACKEND_URL, publicApi } from "./client";
import type {
  Account,
  AdminAccountDetail,
  AdminAccountList,
  AdminAuditPage,
  AdminOverview,
  AdminSession,
  AuthResponse,
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
  register: (payload: {
    email: string;
    password: string;
    displayName?: string;
    referredBy?: string | null;
  }) => publicApi.post<AuthResponse>("/v1/auth/register", payload).then((r) => r.data),

  login: (payload: { email: string; password: string }) =>
    publicApi.post<AuthResponse>("/v1/auth/login", payload).then((r) => r.data),

  /** Nonce + exact message the wallet must sign. */
  walletChallenge: (purpose: "signin" | "link") =>
    publicApi
      .get<{ nonce: string; message: string }>("/v1/auth/wallet/challenge", {
        params: { purpose },
      })
      .then((r) => r.data),

  walletAuth: (payload: {
    walletAddress: string;
    signature: number[];
    nonce: string;
    referredBy?: string | null;
  }) => publicApi.post<AuthResponse>("/v1/auth/wallet", payload).then((r) => r.data),

  me: () => api.get<{ account: Account }>("/v1/auth/me").then((r) => r.data.account),

  logout: () => api.post("/v1/auth/logout").then((r) => r.data),

  updateProfile: (payload: { displayName?: string }) =>
    api.patch<{ account: Account }>("/v1/auth/profile", payload).then((r) => r.data.account),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>("/v1/auth/change-password", payload).then((r) => r.data),

  verifyEmail: (token: string) =>
    publicApi.post<{ message: string }>("/v1/auth/verify-email", { token }).then((r) => r.data),

  resendVerification: () =>
    api.post<{ message: string }>("/v1/auth/resend-verification").then((r) => r.data),

  forgotPassword: (email: string) =>
    publicApi.post<{ message: string }>("/v1/auth/forgot-password", { email }).then((r) => r.data),

  resetPassword: (payload: { token: string; password: string }) =>
    publicApi.post<{ message: string }>("/v1/auth/reset-password", payload).then((r) => r.data),

  linkEmail: (payload: { email: string; password: string }) =>
    api.post<{ account: Account }>("/v1/auth/link-email", payload).then((r) => r.data.account),

  linkWallet: (payload: { walletAddress: string; signature: number[]; nonce: string }) =>
    api.post<{ account: Account }>("/v1/auth/link-wallet", payload).then((r) => r.data.account),

  unlinkWallet: () =>
    api.delete<{ account: Account }>("/v1/auth/link-wallet").then((r) => r.data.account),

  /**
   * Whether the backend has Google OAuth configured.
   *
   * A failure here must never break the login page — email and wallet sign-in
   * still work — so it resolves to `false` rather than throwing. But it says so
   * out loud in development: a silently hidden button is indistinguishable from
   * a broken one, and "why is there no Google button" is otherwise a genuinely
   * hard thing to diagnose (the backend being unreachable, or pointed at the
   * wrong host, looks identical to Google simply being unconfigured).
   */
  googleEnabled: () =>
    publicApi
      .get<{ enabled: boolean }>("/v1/auth/google/status")
      .then((r) => {
        if (!r.data.enabled && process.env.NODE_ENV !== "production") {
          console.info(
            "[dojopay] Google sign-in is hidden: the backend reports it is not configured. " +
              "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.",
          );
        }
        return r.data.enabled;
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[dojopay] Could not reach ${BACKEND_URL}/v1/auth/google/status — hiding the ` +
              "Google button. Check NEXT_PUBLIC_BACKEND_URL and that the backend is running.",
            error,
          );
        }
        return false;
      }),
};

/** Full-page redirect: OAuth cannot happen over XHR. */
export function googleSignInUrl(): string {
  return `${publicApi.defaults.baseURL}/v1/auth/google`;
}

export const creatorEndpoints = {
  listTasks: () => api.get<{ tasks: CreatorTask[] }>("/v1/user/tasks").then((r) => r.data.tasks),

  getTask: (taskId: number) => api.get<CreatorTask>(`/v1/user/task/${taskId}`).then((r) => r.data),

  getTaskResults: (taskId: number) =>
    api.get<TaskResults>("/v1/user/task", { params: { taskId } }).then((r) => r.data),

  createTask: (payload: {
    options: Array<{ imageUrl: string }>;
    title: string;
    signature: string;
    expirationDate?: string | null;
  }) => api.post<{ id: number }>("/v1/user/task", payload).then((r) => r.data),

  updateTask: (taskId: number, payload: { title?: string; expirationDate?: string | null }) =>
    api.patch(`/v1/user/task/${taskId}`, payload).then((r) => r.data),

  dashboard: () => api.get<CreatorDashboard>("/v1/user/dashboard").then((r) => r.data),

  earnings: () => api.get<CreatorEarnings>("/v1/user/earnings").then((r) => r.data),

  presignedUrl: () =>
    api
      .get<{ presignedUrl: string; fields: Record<string, string> }>("/v1/user/presignedUrl")
      .then((r) => r.data),
};

export const workerEndpoints = {
  nextTask: () =>
    api
      .get<WorkerTask>("/v1/worker/nextTask")
      .then((r) => r.data)
      // 404 here means "nothing available", a normal state rather than an error.
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      }),

  submit: (taskId: number, selection: number) =>
    api
      .post<{
        message: string;
        submissionId: number;
        amount: string;
        taskFull: boolean;
        nextTask: WorkerTask | null;
      }>("/v1/worker/submission", { taskId, selection })
      .then((r) => r.data),

  balance: () => api.get<WorkerBalance>("/v1/worker/balance").then((r) => r.data),

  submissions: () =>
    api
      .get<{ submissions: Array<Record<string, unknown>> }>("/v1/worker/submissions")
      .then((r) => r.data.submissions),

  dashboard: () => api.get<WorkerDashboard>("/v1/worker/dashboard").then((r) => r.data),

  earnings: (page = 1, limit = 4) =>
    api.get<WorkerEarnings>("/v1/worker/earnings", { params: { page, limit } }).then((r) => r.data),

  /**
   * Withdraw. Requires a linked wallet — the backend returns 403
   * WALLET_REQUIRED otherwise, which the UI turns into a "connect a wallet"
   * prompt rather than an error.
   */
  payout: (signature: number[]) =>
    api
      .post<{ message: string; signature: string; amount: string }>("/v1/worker/payout", {
        signature,
      })
      .then((r) => r.data),
};

export const publicEndpoints = {
  task: (taskId: number) => publicApi.get<PublicTask>(`/v1/public/task/${taskId}`).then((r) => r.data),
};

export const adminEndpoints = {
  /** Step one. Never returns a session — always a 2FA challenge. */
  login: (payload: { email: string; password: string }) =>
    publicApi
      .post<
        | { stage: "VERIFY_2FA"; challengeToken: string }
        | {
            stage: "ENROLL_2FA";
            challengeToken: string;
            totpSecret: string;
            qrCodeDataUrl: string;
          }
      >("/v1/admin/auth/login", payload)
      .then((r) => r.data),

  verifyTotp: (payload: { challengeToken: string; code: string }) =>
    publicApi
      .post<AdminSession>("/v1/admin/auth/verify", payload)
      .then((r) => r.data),

  enrollTotp: (payload: { challengeToken: string; code: string }) =>
    publicApi.post<AdminSession>("/v1/admin/auth/enroll", payload).then((r) => r.data),

  session: () => adminApi.get<{ admin: AdminSession["admin"] }>("/v1/admin/session").then((r) => r.data.admin),

  overview: () => adminApi.get<AdminOverview>("/v1/admin/overview").then((r) => r.data),

  growth: (days = 30) =>
    adminApi
      .get<{ series: Array<{ date: string; signups: number; submissions: number; tasks: number }> }>(
        "/v1/admin/growth",
        { params: { days } },
      )
      .then((r) => r.data.series),

  accounts: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    provider?: string;
    sort?: string;
  }) => adminApi.get<AdminAccountList>("/v1/admin/accounts", { params }).then((r) => r.data),

  account: (id: number) =>
    adminApi.get<AdminAccountDetail>(`/v1/admin/accounts/${id}`).then((r) => r.data),

  accountActivity: (id: number) =>
    adminApi
      .get<{ entries: AdminAuditPage["entries"] }>(`/v1/admin/accounts/${id}/activity`)
      .then((r) => r.data.entries),

  moderateAccount: (id: number, payload: { action: "SUSPEND" | "BAN" | "REACTIVATE"; reason: string }) =>
    adminApi.post(`/v1/admin/accounts/${id}/moderate`, payload).then((r) => r.data),

  tasks: (params: { page?: number; limit?: number; status?: string }) =>
    adminApi.get<Record<string, any>>("/v1/admin/tasks", { params }).then((r) => r.data),

  forceCloseTask: (id: number, reason: string) =>
    adminApi.post(`/v1/admin/tasks/${id}/force-close`, { reason }).then((r) => r.data),

  audit: (params: Record<string, string | number | undefined>) =>
    adminApi.get<AdminAuditPage>("/v1/admin/audit", { params }).then((r) => r.data),
};

/** Message a worker signs to authorise a withdrawal. Matches the backend byte for byte. */
export function buildWithdrawalMessage(lamports: string, address: string): string {
  return `Withdraw ${lamports} lamports to ${address}`;
}

export * from "./types";
export {
  ApiError,
  BACKEND_URL,
  clearLegacyTokens,
  clearToken,
  getToken,
  setToken,
  type TokenScope,
} from "./client";
