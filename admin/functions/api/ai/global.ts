import { Env, json } from "../../_lib/auth";

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

const SENTINEL_UNCHANGED = "__UNCHANGED__";

function mask(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}

function publish(cfg: AiConfig | null): (AiConfig & { apiKey: string }) | null {
  if (!cfg) return null;
  return { ...cfg, apiKey: mask(cfg.apiKey) };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const cfg = await ctx.env.CHALLENGE_KV.get<AiConfig>("settings:ai:global", "json");

  // Fallback: read worker env legacy via separate hint (we can't read worker env here;
  // we mark it as such if KV is empty).
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
  // apiUrl auto-default по provider если не задан явно
  const PROVIDER_URL: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    gemini:     "https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
    openai:     "https://api.openai.com/v1/chat/completions",
  };
  const apiUrl = body.apiUrl || PROVIDER_URL[body.provider] || "";
  if (!apiUrl) return json({ error: "apiUrl не задан и нет default для provider " + body.provider }, { status: 400 });

  // apiKey resolution order:
  //   1. body.apiKey (если юзер явно вписал) — кроме SENTINEL
  //   2. предыдущий config (SENTINEL → keep stored)
  //   3. shared secrets:ai:tokens[provider] — общий токен для всех конфигов одного провайдера
  let apiKey = body.apiKey ?? "";
  if (apiKey === SENTINEL_UNCHANGED || !apiKey) {
    const prev = await ctx.env.CHALLENGE_KV.get<AiConfig>("settings:ai:global", "json");
    apiKey = prev?.apiKey ?? "";
  }
  if (!apiKey) {
    const shared = (await ctx.env.CHALLENGE_KV.get<{ openrouter?: string; gemini?: string }>("secrets:ai:tokens", "json")) ?? {};
    apiKey = (shared as any)[body.provider] ?? "";
  }
  if (!apiKey) return json({ error: `apiKey не задан. Сохрани токен для ${body.provider} в секции TOKENS на /ai-engine` }, { status: 400 });

  // Preserve previous as :prev for rollback
  const prev = await ctx.env.CHALLENGE_KV.get<AiConfig>("settings:ai:global", "json");
  if (prev) {
    await ctx.env.CHALLENGE_KV.put("settings:ai:global:prev", JSON.stringify(prev));
  }

  const now = Date.now();
  const next: AiConfig = {
    id: body.id ?? crypto.randomUUID(),
    // Name всегда auto-генерится из provider/model — иначе старое имя «прилипает» при смене модели.
    name: `${body.provider}/${body.model}`,
    provider: body.provider,
    apiUrl,
    apiKey,
    model: body.model,
    temperature: body.temperature, // undefined → не отправлять в запрос
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
