import { Env, json } from "../../../../../../_lib/auth";
import { AdminStorage, ChallengeType } from "../../../../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../../../../_lib/guards";

// GET /api/communities/{chatId}/challenges/{type}/{challengeId}/submissions
// Returns submissions[] with computed reactions detail per messageId.

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  const challengeId = parseInt(ctx.params.challengeId as string, 10);
  const type = ctx.params.type as ChallengeType;
  if (!Number.isFinite(challengeId)) {
    return json({ error: "Invalid challengeId" }, { status: 400 });
  }
  if (!["daily","weekly","monthly"].includes(type)) {
    return json({ error: "type must be daily|weekly|monthly" }, { status: 400 });
  }

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);
  const submissions = await s.getSubmissions(chatId, type, challengeId);

  // Pull reactions per submission (community:{chatId}:reactions:{type}:{challengeId}:{messageId})
  const enriched = await Promise.all(
    submissions.map(async (sub) => {
      const key = `community:${chatId}:reactions:${type}:${challengeId}:${sub.messageId}`;
      const reactions = (await ctx.env.CHALLENGE_KV.get<Record<string, number>>(key, "json")) ?? {};
      return { ...sub, reactions, uniqueVoters: Object.keys(reactions).length };
    })
  );

  // Sort by score desc, then timestamp asc
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.timestamp ?? 0) - (b.timestamp ?? 0);
  });

  return json({ chatId, type, challengeId, count: enriched.length, submissions: enriched });
};
