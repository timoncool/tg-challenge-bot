import { Env, json } from "../../../_lib/auth";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  const log = (await ctx.env.CHALLENGE_KV.get<Array<unknown>>(
    `community:${chatId}:ai_history`, "json"
  )) ?? [];
  return json({ chatId, count: log.length, entries: log });
};
