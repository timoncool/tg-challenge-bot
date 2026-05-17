import { Env, json } from "../../_lib/auth";

// GET /api/alerts/log  →  last 100 alerts written by bot to alerts:log
// (Bot will start writing here after refactor; meanwhile may be empty.)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const log = (await ctx.env.CHALLENGE_KV.get<Array<{
    ts: number; severity: "error"|"warn"|"info"; component: string; message: string; context?: unknown;
  }>>("alerts:log", "json")) ?? [];
  return json({ count: log.length, alerts: log.slice(0, 100) });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  await ctx.env.CHALLENGE_KV.delete("alerts:log");
  return json({ ok: true });
};
