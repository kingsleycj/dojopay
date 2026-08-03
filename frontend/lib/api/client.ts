import axios, { AxiosError, type AxiosInstance } from "axios";

/**
 * The one HTTP client.
 *
 * Two token scopes now, not three: a single **account** session covers both
 * creator and worker modes (roles are resolved server-side from profiles), and
 * a separate **admin** session for `/v1/admin`. They are stored under different
 * keys and never sent to each other's endpoints.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://dojopay-backend.onrender.com";

export type TokenScope = "account" | "admin";

const TOKEN_KEYS: Record<TokenScope, string> = {
  account: "dojopay.token",
  admin: "dojopay.adminToken",
};

/** Keys written by the pre-account release, cleared once on load. */
const LEGACY_KEYS = ["token", "workerToken"];

export function getToken(scope: TokenScope): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEYS[scope]);
}

export function setToken(scope: TokenScope, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEYS[scope], token);
  // The storage event only fires in *other* tabs, so same-tab listeners need
  // an explicit nudge.
  window.dispatchEvent(new Event("dojopay:auth-changed"));
}

export function clearToken(scope: TokenScope): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEYS[scope]);
  window.dispatchEvent(new Event("dojopay:auth-changed"));
}

/**
 * Drop tokens from the two-token era. Those tokens were signed with secrets
 * that no longer exist, so keeping them only produces confusing 401s.
 */
export function clearLegacyTokens(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
}

/** Error surface for callers: a stable code plus a message safe to display. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function createClient(scope: TokenScope | null): AxiosInstance {
  const instance = axios.create({ baseURL: BACKEND_URL, timeout: 30_000 });

  instance.interceptors.request.use((config) => {
    if (scope) {
      const token = getToken(scope);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; code?: string; issues?: unknown }>) => {
      const status = error.response?.status ?? 0;
      const code = error.response?.data?.code;

      /**
       * Clear the token only when it is genuinely unusable.
       *
       * A 403 for ACCOUNT_SUSPENDED or WALLET_REQUIRED means the session is
       * fine and the user needs to see the message — signing them out would
       * hide the very explanation they need.
       */
      const sessionIsDead =
        scope && (status === 401 || (status === 403 && code === "ACCOUNT_BANNED"));

      if (sessionIsDead && typeof window !== "undefined") {
        window.localStorage.removeItem(TOKEN_KEYS[scope]);
        window.dispatchEvent(new Event("dojopay:auth-changed"));
      }

      if (status === 0) {
        return Promise.reject(
          new ApiError(0, "Could not reach the server. Check your connection.", "NETWORK_ERROR"),
        );
      }

      return Promise.reject(
        new ApiError(
          status,
          error.response?.data?.message ?? "Something went wrong",
          code ?? "UNKNOWN",
          error.response?.data?.issues,
        ),
      );
    },
  );

  return instance;
}

/** Carries the account session. Used by every creator and worker endpoint. */
export const api = createClient("account");
/** Carries the admin session. Never sent to user endpoints. */
export const adminApi = createClient("admin");
/** No auth header — sign-in, share links, and health. */
export const publicApi = createClient(null);
