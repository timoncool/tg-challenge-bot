import { Env, json } from "../../../_lib/auth";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

const SENTINEL = "__UNCHANGED__";

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

function mask(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const override = await ctx.env.CHALLENGE_KV.get<AiConfig>(`community:${chatId}:settings:ai`, "json");
  if (!override) return json({ override: null, source: "inherits-global" });
  return json({ override: { ...override, apiKey: mask(override.apiKey) }, source: "community" });
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

  let apiKey = body.apiKey ?? "";
  if (apiKey === SENTINEL) {
    const prev = await ctx.env.CHALLENGE_KV.get<AiConfig>(`community:${chatId}:settings:ai`, "json");
    apiKey = prev?.apiKey ?? "";
  }
  if (!apiKey) return json({ error: "apiKey required" }, { status: 400 });

  const cfg: AiConfig = {
    id: body.id ?? crypto.randomUUID(),
    name: body.name ?? `${body.provider}/${body.model}`,
    provider: body.provider,
    apiUrl: body.apiUrl,
    apiKey,
    model: body.model,
    temperature: body.temperature ?? 0.95,
    referer: body.referer,
    title: body.title,
  };
  await ctx.env.CHALLENGE_KV.put(`community:${chatId}:settings:ai`, JSON.stringify(cfg));
  return json({ ok: true, override: { ...cfg, apiKey: mask(cfg.apiKey) } });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;
  await ctx.env.CHALLENGE_KV.delete(`community:${chatId}:settings:ai`);
  return json({ ok: true });
};
