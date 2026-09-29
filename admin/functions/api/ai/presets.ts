import { Env, json } from "../../_lib/auth";
import { maskKey, resolveApiKey } from "../../_lib/aiKeys";

interface AiConfig {
  id: string;
  name: string;
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  referer?: string;
  title?: string;
  fallbacks?: string[];
  createdAt: number;
  updatedAt: number;
}

const PROVIDER_URL: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  gemini:     "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
  openai:     "https://api.openai.com/v1/chat/completions",
};

const publish = (p: AiConfig) => ({ ...p, apiKey: maskKey(p.apiKey) });

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const list = (await ctx.env.CHALLENGE_KV.get<AiConfig[]>("settings:ai:presets", "json")) ?? [];
  return json({ presets: list.map(publish) });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: Partial<AiConfig>;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.provider || !body.model) {
    return json({ error: "provider, model required" }, { status: 400 });
  }
  const apiUrl = body.apiUrl || PROVIDER_URL[body.provider] || "";
  if (!apiUrl) return json({ error: "apiUrl не задан и нет default для provider " + body.provider }, { status: 400 });
  const apiKey = await resolveApiKey(ctx.env.CHALLENGE_KV, body.provider, body.apiKey);
  if (!apiKey) return json({ error: `apiKey не задан. Сохрани токен для ${body.provider} в секции TOKENS на /ai-engine` }, { status: 400 });
  const list = (await ctx.env.CHALLENGE_KV.get<AiConfig[]>("settings:ai:presets", "json")) ?? [];
  const now = Date.now();
  const next: AiConfig = {
    id: crypto.randomUUID(),
    name: `${body.provider}/${body.model}`,
    provider: body.provider,
    apiUrl,
    apiKey,
    model: body.model,
    temperature: body.temperature,
    referer: body.referer,
    title: body.title,
    fallbacks: body.fallbacks,
    createdAt: now,
    updatedAt: now,
  };
  list.push(next);
  await ctx.env.CHALLENGE_KV.put("settings:ai:presets", JSON.stringify(list));
  return json({ ok: true, preset: publish(next) });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  // PUT /api/ai/presets?id={id} — update an existing preset
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id required" }, { status: 400 });

  let body: Partial<Omit<AiConfig, "temperature">> & { temperature?: number | null };
  try { body = await ctx.request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }

  const list = (await ctx.env.CHALLENGE_KV.get<AiConfig[]>("settings:ai:presets", "json")) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return json({ error: "preset not found" }, { status: 404 });

  const prev = list[idx];
  // Reject explicit-empty for required fields (UI bug guard)
  for (const k of ["provider", "apiUrl", "model"] as const) {
    if (body[k] !== undefined && (body[k] as string).trim() === "") {
      return json({ error: `${k} cannot be empty string` }, { status: 400 });
    }
  }
  const provider = body.provider ?? prev.provider;
  const apiKey = await resolveApiKey(ctx.env.CHALLENGE_KV, provider, body.apiKey, prev);
  if (!apiKey) return json({ error: `apiKey не задан. Сохрани токен для ${provider} в секции TOKENS на /ai-engine` }, { status: 400 });
  const model = body.model ?? prev.model;
  list[idx] = {
    ...prev,
    name: `${provider}/${model}`,
    provider,
    apiUrl: body.apiUrl ?? (body.provider && body.provider !== prev.provider ? PROVIDER_URL[provider] ?? prev.apiUrl : prev.apiUrl),
    apiKey,
    model,
    // null clears it: the model's own default is used.
    temperature: body.temperature === null ? undefined : body.temperature ?? prev.temperature,
    referer: body.referer ?? prev.referer,
    title: body.title ?? prev.title,
    fallbacks: body.fallbacks ?? prev.fallbacks,
    updatedAt: Date.now(),
  };
  await ctx.env.CHALLENGE_KV.put("settings:ai:presets", JSON.stringify(list));
  return json({ ok: true, preset: publish(list[idx]) });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id required" }, { status: 400 });
  const list = (await ctx.env.CHALLENGE_KV.get<AiConfig[]>("settings:ai:presets", "json")) ?? [];
  const next = list.filter((p) => p.id !== id);
  await ctx.env.CHALLENGE_KV.put("settings:ai:presets", JSON.stringify(next));
  return json({ ok: true });
};
