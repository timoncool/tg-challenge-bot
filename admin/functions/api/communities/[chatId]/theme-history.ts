import { Env, json } from "../../../_lib/auth";
import { ChallengeType } from "../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

const isValidType = (t: string): t is ChallengeType => ["daily","weekly","monthly"].includes(t);

// GET    /api/communities/{chatId}/theme-history?type=daily|all
// DELETE /api/communities/{chatId}/theme-history?type=daily

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const url = new URL(ctx.request.url);
  const t = url.searchParams.get("type") ?? "all";
  if (t !== "all" && !isValidType(t)) return json({ error: "bad type" }, { status: 400 });
  const types: ChallengeType[] = t === "all" ? ["daily","weekly","monthly"] : [t as ChallengeType];

  const data = await Promise.all(
    types.map(async (type) => ({
      type,
      themes: (await ctx.env.CHALLENGE_KV.get<string[]>(`community:${chatId}:theme_history:${type}`, "json")) ?? [],
    }))
  );
  return json({ chatId, perType: data });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  const url = new URL(ctx.request.url);
  const t = url.searchParams.get("type");
  if (t && !isValidType(t)) return json({ error: "bad type" }, { status: 400 });
  const types = t ? [t] : ["daily","weekly","monthly"];
  for (const tp of types) await ctx.env.CHALLENGE_KV.delete(`community:${chatId}:theme_history:${tp}`);
  return json({ ok: true, cleared: types.length });
};
