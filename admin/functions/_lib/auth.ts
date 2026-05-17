// Auth helpers for Pages Functions.
// Cookie: admin_session=<base64url(ts.signature)>; HttpOnly; Secure; SameSite=Strict; 7d
// signature = HMAC-SHA256(env.AUTH_HMAC_KEY, `${ts}.${env.ADMIN_SECRET}`)
//
// We do NOT store ADMIN_SECRET in the cookie. Cookie is just a stamped marker —
// presence + valid HMAC + ts within last 7 days = authenticated.

const COOKIE_NAME = "admin_session";
const MAX_AGE_SECONDS = 7 * 24 * 3600;

export interface Env {
  CHALLENGE_KV: KVNamespace;
  ADMIN_SECRET: string;
  AUTH_HMAC_KEY: string;
  BOT_WORKER_URL?: string;
  BOT_ADMIN_SECRET?: string;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function makeCookie(env: Env): Promise<string> {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = b64url(await hmac(env.AUTH_HMAC_KEY, `${ts}.${env.ADMIN_SECRET}`));
  const value = b64url(new TextEncoder().encode(`${ts}.${sig}`));
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function verifyCookie(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_SECRET || !env.AUTH_HMAC_KEY) return false;

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.split(";").map((s) => s.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  try {
    const raw = match.slice(COOKIE_NAME.length + 1);
    const decoded = new TextDecoder().decode(b64urlDecode(raw));
    const [tsStr, sig] = decoded.split(".");
    const ts = parseInt(tsStr, 10);
    if (!Number.isFinite(ts)) return false;

    const ageSec = Math.floor(Date.now() / 1000) - ts;
    if (ageSec < 0 || ageSec > MAX_AGE_SECONDS) return false;

    const expected = b64url(await hmac(env.AUTH_HMAC_KEY, `${tsStr}.${env.ADMIN_SECRET}`));
    return constantTimeEqual(expected, sig);
  } catch {
    return false;
  }
}

export async function verifySecret(env: Env, secret: string): Promise<boolean> {
  if (!env.ADMIN_SECRET) return false;
  return constantTimeEqual(env.ADMIN_SECRET, secret);
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export function unauthorized(): Response {
  return json({ error: "Unauthorized" }, { status: 401 });
}
