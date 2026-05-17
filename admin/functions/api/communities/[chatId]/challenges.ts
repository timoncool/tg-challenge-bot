import { Env, json } from "../../../_lib/auth";
import { AdminStorage, ChallengeType } from "../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

// GET /api/communities/{chatId}/challenges?type=daily|weekly|monthly
// Returns: { active: Challenge|null, history: [{ challengeId, type, submissionCount, hasReactions }] }
// History is reconstructed from KV keys (no dedicated challenges:history key in bot).

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const url = new URL(ctx.request.url);
  const filterType = url.searchParams.get("type") as ChallengeType | null;
  const types: ChallengeType[] = filterType ? [filterType] : ["daily", "weekly", "monthly"];

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);

  // 1. current per type (active or last finished)
  const current = await Promise.all(
    types.map(async (t) => ({ type: t, challenge: await s.getChallenge(chatId, t) }))
  );

  // 2. history — list submission keys prefixed community:{chatId}:submissions:{type}:
  // Each unique challengeId means there was a challenge.
  const history: Array<{
    type: ChallengeType;
    challengeId: number;
    submissionCount: number;
  }> = [];

  // Parallel per-type listing, parallel per-challenge submission fetch.
  // Was N+1 sequential — would time out on histories with 50+ challenges.
  await Promise.all(types.map(async (t) => {
    const prefix = `community:${chatId}:submissions:${t}:`;
    const ids: number[] = [];
    let cursor: string | undefined;
    do {
      const r = await ctx.env.CHALLENGE_KV.list({ prefix, cursor });
      for (const k of r.keys) {
        const challengeId = parseInt(k.name.slice(prefix.length), 10);
        if (Number.isFinite(challengeId)) ids.push(challengeId);
      }
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);

    const subsArrays = await Promise.all(ids.map((id) => s.getSubmissions(chatId, t, id)));
    for (let i = 0; i < ids.length; i++) {
      history.push({ type: t, challengeId: ids[i], submissionCount: subsArrays[i].length });
    }
  }));

  // Sort history newest-first by challengeId
  history.sort((a, b) => b.challengeId - a.challengeId);

  return json({ current, history });
};
