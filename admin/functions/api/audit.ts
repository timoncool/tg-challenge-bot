import { Env, json } from "../_lib/auth";
import type { AuditEvent } from "../_lib/audit";

// GET /api/audit?limit=200&chatId=...
// Keys are stored with reverse-timestamp prefix, so kv.list returns newest first.
// Full AuditEvent lives in each key's metadata — zero per-key kv.get calls.

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200", 10) || 200));
  const chatIdFilter = url.searchParams.get("chatId");
  const chatId = chatIdFilter ? parseInt(chatIdFilter, 10) : undefined;

  const events: AuditEvent[] = [];
  let cursor: string | undefined;
  let pages = 0;
  let truncated = false;

  // Pull pages until we have `limit` matching events or run out
  while (events.length < limit && pages < 20) {
    const r = await ctx.env.CHALLENGE_KV.list<AuditEvent>({
      prefix: "audit:event:",
      cursor,
      limit: 1000,
    });
    for (const k of r.keys) {
      const ev = k.metadata;
      if (!ev) continue; // legacy keys without metadata — skip
      if (chatId !== undefined && ev.chatId !== chatId) continue;
      events.push(ev);
      if (events.length >= limit) break;
    }
    pages++;
    if (r.list_complete) { cursor = undefined; break; }
    cursor = r.cursor;
    if (events.length >= limit) { truncated = true; break; }
  }

  return json({
    count: events.length,
    truncated,
    events,
  });
};
