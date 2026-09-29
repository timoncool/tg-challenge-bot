// Thin fetch wrapper for /api/* endpoints served by Pages Functions.
// Auth is via HttpOnly cookie set by /api/auth/login — we don't manage tokens here.

/** Fired when the session cookie is no longer accepted; the auth provider shows the login page. */
export const SESSION_EXPIRED_EVENT = "admin:session-expired";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });

  let payload: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      payload = await res.json();
    } catch {
      // Ignore JSON parse failures — fall through to status-based handling.
    }
  } else {
    payload = await res.text();
  }

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  if (!res.ok) {
    const msg =
      (typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : undefined) ??
      (typeof payload === "string" ? payload : undefined) ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, payload, msg);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
