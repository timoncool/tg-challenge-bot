import { Env, json } from "../../_lib/auth";

// GET /api/stats/ai?days=14
// Aggregate by day stats:ai:daily:YYYY-MM-DD + global history
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") ?? "14", 10)));

  const today = new Date();
  const out: any[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dayKey = d.toISOString().slice(0, 10);
    const data = await ctx.env.CHALLENGE_KV.get(`stats:ai:daily:${dayKey}`, "json");
    out.push({ day: dayKey, ...(data || { totals: {calls:0,success:0,fail:0,totalCostUsd:0,totalTokens:0}, byProvider: {}, byModel: {} }) });
  }

  // recent global feed (last 50)
  const recent = ((await ctx.env.CHALLENGE_KV.get<unknown[]>("ai:history:global", "json")) ?? []).slice(0, 50);

  // aggregate totals
  const totals = { calls: 0, success: 0, fail: 0, cost: 0, tokens: 0 };
  for (const d of out) {
    totals.calls   += d.totals?.calls ?? 0;
    totals.success += d.totals?.success ?? 0;
    totals.fail    += d.totals?.fail ?? 0;
    totals.cost    += d.totals?.totalCostUsd ?? 0;
    totals.tokens  += d.totals?.totalTokens ?? 0;
  }

  return json({ days, totals, daily: out.reverse(), recent });
};
