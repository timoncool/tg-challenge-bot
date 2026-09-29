import { Env, json } from "../../_lib/auth";
import { maskKey, resolveApiKey } from "../../_lib/aiKeys";

// AiConfig in KV: settings:ai:global (and per-community via settings:ai)
interface AiConfig {
  id: string;
  name: string;
  provider: "gemini" | "openai" | "openrouter" | "custom";
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  referer?: string;
  title?: string;
  fallbacks?: string[];
  supportsJsonMode?: boolean;
  createdAt: number;
  updatedAt: number;
}

const PROVIDER_URL: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  gemini:     "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
  openai:     "https://api.openai.com/v1/chat/completions",
};

function publish(cfg: AiConfig | null): (AiConfig & { apiKey: string }) | null {
  if (!cfg) return null;
  return { ...cfg, apiKey: maskKey(cfg.apiKey) };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const cfg = await ctx.env.CHALLENGE_KV.get<AiConfig>("settings:ai:global", "json");

  // The worker's env config can't be read from here; an empty KV means the bot uses it.
  if (!cfg) {
    return json({
      source: "env-legacy",
      config: null,
      hint: "Бот пока берёт AI из env воркера. Нажми Save чтобы заменить на KV-конфиг.",
    });
  }

  return json({ source: "kv", config: publish(cfg) });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  let body: Partial<AiConfig>;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.provider || !body.model) {
    return json({ error: "provider, model are required" }, { status: 400 });
  }
  const apiUrl = body.apiUrl || PROVIDER_URL[body.provider] || "";
  if (!apiUrl) return json({ error: "apiUrl не задан и нет default для provider " + body.provider }, { status: 400 });

  const prev = await ctx.env.CHALLENGE_KV.get<AiConfig>("settings:ai:global", "json");
  const apiKey = await resolveApiKey(ctx.env.CHALLENGE_KV, body.provider, body.apiKey, prev);
  if (!apiKey) return json({ error: `apiKey не задан. Сохрани токен для ${body.provider} в секции TOKENS на /ai-engine` }, { status: 400 });

  // Previous config kept as :prev for rollback.
  if (prev) {
    await ctx.env.CHALLENGE_KV.put("settings:ai:global:prev", JSON.stringify(prev));
  }

  const now = Date.now();
  const next: AiConfig = {
    id: body.id ?? crypto.randomUUID(),
    // Name always follows provider/model, or the old name sticks after a model change.
    name: `${body.provider}/${body.model}`,
    provider: body.provider,
    apiUrl,
    apiKey,
    model: body.model,
    temperature: body.temperature, // undefined → not sent to the model
    referer: body.referer,
    title: body.title,
    fallbacks: body.fallbacks,
    supportsJsonMode: body.supportsJsonMode,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };

  await ctx.env.CHALLENGE_KV.put("settings:ai:global", JSON.stringify(next));
  return json({ ok: true, config: publish(next) });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  // Require explicit confirm — bot will silently fall back to env, easy to misclick.
  const url = new URL(ctx.request.url);
  if (url.searchParams.get("confirm") !== "YES_I_KNOW") {
    return json({
      error: "Сброс global AI config — destructive. Добавь ?confirm=YES_I_KNOW",
      hint: "Бот перейдёт на env (legacy) пока не задашь новый global. :prev backup сохранится автоматически.",
    }, { status: 403 });
  }
  // Move current to :prev so it can be restored
  const cur = await ctx.env.CHALLENGE_KV.get("settings:ai:global", "json");
  if (cur) await ctx.env.CHALLENGE_KV.put("settings:ai:global:prev", JSON.stringify(cur));
  await ctx.env.CHALLENGE_KV.delete("settings:ai:global");
  return json({ ok: true });
};
