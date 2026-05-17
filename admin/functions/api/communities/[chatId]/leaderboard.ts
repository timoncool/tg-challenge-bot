import { Env, json } from "../../../_lib/auth";
import { AdminStorage, ChallengeType } from "../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

// GET /api/communities/{chatId}/leaderboard?type=daily|weekly|monthly|all
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const url = new URL(ctx.request.url);
  const t = url.searchParams.get("type") ?? "all";
  if (t !== "all" && !["daily","weekly","monthly"].includes(t)) {
    return json({ error: "type must be daily|weekly|monthly|all" }, { status: 400 });
  }

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);
  const types: ChallengeType[] = t === "all" ? ["daily","weekly","monthly"] : [t as ChallengeType];

  const data = await Promise.all(
    types.map(async (type) => ({ type, entries: await s.getLeaderboard(chatId, type) }))
  );

  // Aggregated total view across all types
  const totals: Record<string, { userId: number; username?: string; wins: number; participations: number }> = {};
  for (const { entries } of data) {
    for (const e of entries) {
      const k = String(e.userId);
      if (!totals[k]) totals[k] = { userId: e.userId, username: e.username, wins: 0, participations: 0 };
      totals[k].wins += e.wins ?? 0;
      totals[k].participations += e.participations ?? 0;
      if (e.username) totals[k].username = e.username;
    }
  }
  const aggregated = Object.values(totals).sort((a, b) => b.wins - a.wins || b.participations - a.participations);

  return json({ chatId, perType: data, aggregated });
};
