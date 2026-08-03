import axios, { AxiosError, type AxiosInstance } from "axios";

/**
 * The one HTTP client.
 *
 * Before this, 28 call sites each built their own axios request, attached the
 * auth header by hand, and reimplemented 401 handling — several of them
 * incorrectly. Auth and error handling now live in interceptors.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://dojopay-backend.onrender.com";

export type Role = "creator" | "worker";

const TOKEN_KEYS: Record<Role, string> = {
  creator: "token",
  worker: "workerToken",
};

export function getToken(role: Role): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEYS[role]);
}

export function setToken(role: Role, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEYS[role], token);
  // Same-tab listeners: the storage event only fires in *other* tabs.
  window.dispatchEvent(new Event("dojopay:auth-changed"));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEYS.creator);
  window.localStorage.removeItem(TOKEN_KEYS.worker);
  window.dispatchEvent(new Event("dojopay:auth-changed"));
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

function createClient(role: Role | null): AxiosInstance {
  const instance = axios.create({ baseURL: BACKEND_URL, timeout: 30_000 });

  instance.interceptors.request.use((config) => {
    if (role) {
      const token = getToken(role);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; code?: string; issues?: unknown }>) => {
      const status = error.response?.status ?? 0;

      // An expired or forged token: drop it so the UI can re-authenticate.
      // Redirecting is the caller's job — this used to hard-assign
      // `window.location.href` from inside a data fetch, which threw away
      // whatever the user was doing.
      if (role && (status === 401 || status === 403)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(TOKEN_KEYS[role]);
          window.dispatchEvent(new Event("dojopay:auth-changed"));
        }
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
          error.response?.data?.code ?? "UNKNOWN",
          error.response?.data?.issues,
        ),
      );
    },
  );

  return instance;
}

export const creatorApi = createClient("creator");
export const workerApi = createClient("worker");
/** No auth header — sign-in and share-link endpoints. */
export const publicApi = createClient(null);
