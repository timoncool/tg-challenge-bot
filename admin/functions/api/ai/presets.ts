import { Env, json } from "../../_lib/auth";

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

function mask(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const list = (await ctx.env.CHALLENGE_KV.get<AiConfig[]>("settings:ai:presets", "json")) ?? [];
  return json({ presets: list.map((p) => ({ ...p, apiKey: mask(p.apiKey) })) });
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
  const PROVIDER_URL: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    gemini:     "https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
    openai:     "https://api.openai.com/v1/chat/completions",
  };
  const apiUrl = body.apiUrl || PROVIDER_URL[body.provider] || "";
  if (!apiUrl) return json({ error: "apiUrl не задан и нет default для provider " + body.provider }, { status: 400 });
  // apiKey: explicit > shared secrets:ai:tokens[provider]
  let apiKey = body.apiKey && body.apiKey !== "__UNCHANGED__" ? body.apiKey : "";
  if (!apiKey) {
    const shared = (await ctx.env.CHALLENGE_KV.get<{ openrouter?: string; gemini?: string }>("secrets:ai:tokens", "json")) ?? {};
    apiKey = (shared as any)[body.provider] ?? "";
  }
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
  return json({ ok: true, preset: { ...next, apiKey: mask(next.apiKey) } });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  // PUT /api/ai/presets?id={id}  — update existing preset, sentinel apiKey support
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id required" }, { status: 400 });

  let body: Partial<AiConfig>;
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
  const apiKey = body.apiKey === "__UNCHANGED__" || !body.apiKey ? prev.apiKey : body.apiKey;
  const finalProvider = body.provider ?? prev.provider;
  const finalModel = body.model ?? prev.model;
  list[idx] = {
    ...prev,
    name: `${finalProvider}/${finalModel}`,
    provider: finalProvider,
    apiUrl: body.apiUrl ?? prev.apiUrl,
    apiKey,
    model: body.model ?? prev.model,
    temperature: body.temperature ?? prev.temperature,
    referer: body.referer ?? prev.referer,
    title: body.title ?? prev.title,
    fallbacks: body.fallbacks ?? prev.fallbacks,
    updatedAt: Date.now(),
  };
  await ctx.env.CHALLENGE_KV.put("settings:ai:presets", JSON.stringify(list));
  return json({ ok: true, preset: { ...list[idx], apiKey: mask(list[idx].apiKey) } });
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
