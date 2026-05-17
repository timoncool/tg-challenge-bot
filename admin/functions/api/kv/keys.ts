import { Env, json } from "../../_lib/auth";

// GET /api/kv/keys?prefix=...&cursor=...&limit=100
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const prefix = url.searchParams.get("prefix") ?? "";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1000);

  const r = await ctx.env.CHALLENGE_KV.list({ prefix, cursor, limit });
  return json({
    keys: r.keys.map((k) => ({ name: k.name, expiration: k.expiration ?? null, metadata: k.metadata ?? null })),
    cursor: r.list_complete ? null : r.cursor,
    list_complete: r.list_complete,
  });
};
