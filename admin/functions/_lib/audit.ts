// Append-only audit log of admin write actions.
// Each event becomes its own KV key — `audit:event:{revTs}-{rand}` — avoiding the
// read-modify-write race that would happen with a single growing list.
//
// Storage trick: full AuditEvent JSON goes into the key's **metadata** (KV supports
// up to 1024 bytes per key). Reader uses `kv.list()` only — no per-key `kv.get`,
// so even thousands of events stay within the Pages Functions subrequest cap.
//
// Sort trick: KV returns keys in lexicographic order. We prefix with REVERSE
// timestamp (`MAX - ts`, fixed-width) so newest sorts FIRST and pagination
// returns recent events without scanning the entire history.

import type { Env } from "./auth";

export type AuditEvent = {
  ts: number;
  ip: string;
  ua: string;
  method: string;
  path: string;
  status: number;
  chatId?: number;
  action?: string;
};

const TTL_DAYS = 90;

// Year 2286 in ms — large enough that any real timestamp subtracted from it
// stays positive and produces a fixed-width zero-padded reverse value.
const REV_BASE = 9_999_999_999_999;

function reverseTs(ts: number): string {
  return String(REV_BASE - ts).padStart(13, "0");
}

function randomShort(): string {
  // 8 hex chars from crypto.getRandomValues — collision-resistant per ms
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractChatId(pathname: string): number | undefined {
  const m = pathname.match(/^\/api\/communities\/(-?\d+)\b/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

function extractAction(pathname: string, method: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return `${method} ${last || pathname}`;
}

/**
 * Best-effort fire-and-forget audit log writer. Failures swallowed.
 * Designed for use after request handler completes, ideally via ctx.waitUntil.
 */
export async function logAuditEvent(env: Env, request: Request, response: Response): Promise<void> {
  try {
    const url = new URL(request.url);
    const method = request.method;
    // Only log writes — GETs are noisy and not security-relevant for audit
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

    const ts = Date.now();
    const ev: AuditEvent = {
      ts,
      ip: request.headers.get("CF-Connecting-IP") || "",
      ua: (request.headers.get("User-Agent") || "").slice(0, 200),
      method,
      path: url.pathname,
      status: response.status,
      chatId: extractChatId(url.pathname),
      action: extractAction(url.pathname, method),
    };

    // Reverse-timestamp prefix so newest sorts first in kv.list lex order.
    const key = `audit:event:${reverseTs(ts)}-${randomShort()}`;

    // Store the event in the key's metadata (fits within 1024-byte cap) so the
    // reader can do kv.list() only, without per-key kv.get. Value is empty.
    await env.CHALLENGE_KV.put(key, "", {
      expirationTtl: TTL_DAYS * 24 * 3600,
      metadata: ev,
    });
  } catch {
    // Intentionally swallowed — auditing must never break a real request
  }
}
