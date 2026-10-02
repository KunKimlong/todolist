import type { Todo, TodoInput } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string>,
    /** Seconds to wait before retrying, when the server rate-limits the request */
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/** Send the browser to the login page, remembering where to come back to */
function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  window.location.replace(`/login?expired=1&next=${encodeURIComponent(next)}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      // Auth is the HttpOnly session cookie; send it even if the API is on another origin
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  if (!res.ok) {
    // Session missing or expired while using the app
    if (res.status === 401 && !path.startsWith("/auth/")) {
      redirectToLogin();
      throw new ApiError("Your session has ended. Please sign in again.", 401);
    }
    const body = await res.json().catch(() => null);
    const fieldErrors = body?.errors as Record<string, string> | undefined;
    const message =
      (fieldErrors && Object.values(fieldErrors)[0]) ||
      body?.detail ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status, fieldErrors, body?.retryAfterSeconds);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CurrentUser {
  email: string;
}

export interface CodeSent {
  /** Masked address the code went to, e.g. m•••e@gmail.com (null for forgot-password) */
  sentTo: string | null;
  resendAfterSeconds: number;
  expiresInMinutes: number;
}

export interface Account {
  email: string;
  passwordChangedAt: string;
}

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const authApi = {
  login: (email: string, password: string) => request<CurrentUser>("/auth/login", json({ email, password })),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<CurrentUser>("/auth/me"),
  /** Forgot password: always succeeds, whether or not the email matches */
  requestPasswordReset: (email: string) => request<CodeSent>("/auth/password-reset/request", json({ email })),
  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    request<void>("/auth/password-reset/confirm", json({ email, code, newPassword })),
};

export const accountApi = {
  get: () => request<Account>("/account"),
  sendPasswordCode: () => request<CodeSent>("/account/password/code", { method: "POST" }),
  changePassword: (code: string, newPassword: string) =>
    request<void>("/account/password", json({ code, newPassword })),
};

export const todoApi = {
  list: () => request<Todo[]>("/todos"),
  create: (input: TodoInput) =>
    request<Todo>("/todos", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: TodoInput) =>
    request<Todo>(`/todos/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  toggle: (id: number) => request<Todo>(`/todos/${id}/toggle`, { method: "PATCH" }),
  remove: (id: number) => request<void>(`/todos/${id}`, { method: "DELETE" }),
  /** Fire-and-forget delete that the browser keeps alive while the page is closing */
  removeOnUnload: (id: number) => {
    fetch(`${API_BASE}/todos/${id}`, { method: "DELETE", keepalive: true, credentials: "include" }).catch(
      () => {},
    );
  },
};
