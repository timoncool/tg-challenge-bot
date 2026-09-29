import { Env, json } from "../../../_lib/auth";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";
import { maskKey, resolveApiKey } from "../../../_lib/aiKeys";

interface AiConfig {
  id?: string;
  name: string;
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  referer?: string;
  title?: string;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const override = await ctx.env.CHALLENGE_KV.get<AiConfig>(`community:${chatId}:settings:ai`, "json");
  if (!override) return json({ override: null, source: "inherits-global" });
  return json({ override: { ...override, apiKey: maskKey(override.apiKey) }, source: "community" });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  let body: Partial<AiConfig>;
  try { body = await ctx.request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.provider || !body.apiUrl || !body.model) {
    return json({ error: "provider, apiUrl, model required" }, { status: 400 });
  }

  const key = `community:${chatId}:settings:ai`;
  const prev = await ctx.env.CHALLENGE_KV.get<AiConfig>(key, "json");
  const apiKey = await resolveApiKey(ctx.env.CHALLENGE_KV, body.provider, body.apiKey, prev);
  if (!apiKey) return json({ error: `apiKey не задан. Сохрани токен для ${body.provider} в секции TOKENS на /ai-engine` }, { status: 400 });

  const cfg: AiConfig = {
    id: body.id ?? crypto.randomUUID(),
    // Name follows provider/model like the global engine's, so it never names the old model.
    name: `${body.provider}/${body.model}`,
    provider: body.provider,
    apiUrl: body.apiUrl,
    apiKey,
    model: body.model,
    temperature: body.temperature, // undefined → not sent to the model
    referer: body.referer,
    title: body.title,
  };
  await ctx.env.CHALLENGE_KV.put(key, JSON.stringify(cfg));
  return json({ ok: true, override: { ...cfg, apiKey: maskKey(cfg.apiKey) } });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  await ctx.env.CHALLENGE_KV.delete(`community:${chatId}:settings:ai`);
  return json({ ok: true });
};
