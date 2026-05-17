import { Env, json } from "../../../../../_lib/auth";
import { AdminStorage, ChallengeType } from "../../../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../../../_lib/guards";

// PATCH /api/communities/{chatId}/challenges/{type}/extend  {hours}
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  const type = ctx.params.type as ChallengeType;
  if (!["daily","weekly","monthly"].includes(type)) return json({ error: "type" }, { status: 400 });

  let body: { hours?: number };
  try { body = await ctx.request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }
  const hours = body.hours;
  if (!Number.isFinite(hours) || (hours as number) < 1 || (hours as number) > 168) {
    return json({ error: "hours: 1..168" }, { status: 400 });
  }

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);
  const ch = await s.getChallenge(chatId, type);
  if (!ch) return json({ error: "no active challenge" }, { status: 404 });
  if (ch.status !== "active") return json({ error: "challenge is not active" }, { status: 409 });

  ch.endsAt = ch.endsAt + (hours as number) * 3600 * 1000;
  await ctx.env.CHALLENGE_KV.put(`community:${chatId}:challenge:${type}`, JSON.stringify(ch));
  return json({ ok: true, endsAt: ch.endsAt });
};
