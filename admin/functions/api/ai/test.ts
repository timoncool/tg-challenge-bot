import { Env, json } from "../../_lib/auth";
import { SHARED_TOKENS_KEY, typedKey } from "../../_lib/aiKeys";
import { DEFAULT_PROMPTS, PromptsConfig } from "../../_lib/defaultPrompts";

const TYPE_NAMES: Record<string, string> = {
  daily: "ДНЕВНОГО",
  weekly: "НЕДЕЛЬНОГО",
  monthly: "МЕСЯЧНОГО",
};

async function loadPrompts(kv: KVNamespace): Promise<PromptsConfig> {
  const stored = await kv.get<PromptsConfig>("settings:ai:prompts", "json");
  return stored ?? DEFAULT_PROMPTS;
}

// Same rendering as the bot's buildThemesPrompt: one pass over the template with a function
// replacer, so placeholders inside edited text stay literal and `$&` patterns do not expand.
function buildPrompt(p: PromptsConfig, mode: "vanilla" | "medium" | "nsfw", type: string, sampleSize = 20) {
  const modeCfg = p.modes[mode];
  const a = modeCfg.corpus.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const values: Record<string, string> = {
    TYPE: TYPE_NAMES[type] || "ДНЕВНОГО",
    MODE: mode.toUpperCase(),
    INSTRUCTION: modeCfg.instruction,
    SAMPLE: a.slice(0, sampleSize).join(", "),
    HISTORY: "",
  };
  return p.template.replace(/\{(TYPE|MODE|INSTRUCTION|SAMPLE|HISTORY)\}/g, (_, key: string) => values[key]);
}

interface AiConfigInput {
  provider: "gemini" | "openai" | "openrouter" | "custom";
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  referer?: string;
  title?: string;
}

// Must match the bot's AI_MAX_TOKENS so the test reproduces production.
const AI_MAX_TOKENS = 5000;

interface TestReq {
  config?: AiConfigInput;     // inline config
  useGlobal?: boolean;        // pull settings:ai:global from KV
  usePresetId?: string;       // pull a specific preset from settings:ai:presets
  type?: "daily" | "weekly" | "monthly";
  modes?: ("vanilla" | "medium" | "nsfw")[];
  // Overrides когда выбран preset/global, но юзер на странице сменил модель
  // или температуру через Select/Slider — должны применяться поверх saved config.
  modelOverride?: string;
  temperatureOverride?: number;
}

async function callAi(cfg: AiConfigInput, prompt: string): Promise<{ text: string; usage?: unknown; raw?: unknown }> {
  // Stored Gemini URLs carry a {model} placeholder, as in the bot.
  const url = cfg.apiUrl.replace(/\{model\}/gi, () => cfg.model);
  if (cfg.provider === "gemini") {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: cfg.temperature ?? 1.0,
          responseMimeType: "application/json",
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
        ],
      }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as any;
    const parts: { text?: string; thought?: boolean }[] = j.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
    const m = j.usageMetadata;
    const usage = m
      ? { prompt_tokens: m.promptTokenCount, completion_tokens: m.candidatesTokenCount, total_tokens: m.totalTokenCount }
      : undefined;
    return { text, usage, raw: j };
  }

  // OpenAI-compatible (openai / openrouter / custom)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    if (cfg.referer) headers["HTTP-Referer"] = cfg.referer;
    if (cfg.title) headers["X-Title"] = cfg.title;
  }
  const reqBody: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: "Ты — креативный директор русскоязычного арт-сообщества. Отвечай ТОЛЬКО на русском. Формат: валидный JSON массив строк." },
      { role: "user", content: prompt },
    ],
  };
  // Only forward temperature if explicitly set — many models reject it (GPT-5, o1, o3 etc.)
  if (typeof cfg.temperature === "number") reqBody.temperature = cfg.temperature;
  reqBody.max_tokens = cfg.maxTokens ?? AI_MAX_TOKENS;
  // OpenRouter returns cost in usage only when explicitly asked
  if (cfg.provider === "openrouter") reqBody.usage = { include: true };
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(reqBody) });
  if (!r.ok) throw new Error(`${cfg.provider} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as any;
  let text = j.choices?.[0]?.message?.content || "";
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  // Normalize: OpenRouter returns usage.cost, we expose it as total_cost for the UI
  const usage = j.usage ? { ...j.usage, total_cost: j.usage.total_cost ?? j.usage.cost } : undefined;
  return { text, usage, raw: j };
}

// Same schema as bot worker's logAiAttempt — keeps AI Stats unified.
// We write only global + daily aggregate (per-community log is only for real bot calls).
async function logAiAttempt(kv: KVNamespace, entry: Record<string, unknown>) {
  const stamped = { ts: Date.now(), ...entry, chatId: null };
  try {
    const gkey = "ai:history:global";
    const g = ((await kv.get(gkey, "json")) as unknown[]) || [];
    g.unshift(stamped);
    await kv.put(gkey, JSON.stringify(g.slice(0, 200)), { expirationTtl: 30 * 24 * 3600 });
    const day = new Date().toISOString().slice(0, 10);
    const skey = `stats:ai:daily:${day}`;
    const s = ((await kv.get(skey, "json")) as any) || {
      day, totals: { calls: 0, success: 0, fail: 0, totalDurationMs: 0, totalCostUsd: 0, totalTokens: 0 },
      byProvider: {}, byModel: {},
    };
    s.totals.calls++;
    s.totals[entry.success ? "success" : "fail"]++;
    s.totals.totalDurationMs += (entry.durationMs as number) || 0;
    if (typeof entry.cost_usd === "number") s.totals.totalCostUsd += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.totals.totalTokens += entry.total_tokens;
    const pkey = (entry.provider as string) || "?";
    s.byProvider[pkey] = s.byProvider[pkey] || { calls: 0, cost: 0, tokens: 0 };
    s.byProvider[pkey].calls++;
    if (typeof entry.cost_usd === "number") s.byProvider[pkey].cost += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.byProvider[pkey].tokens += entry.total_tokens;
    const mkey = `${(entry.provider as string) || "?"}/${(entry.model as string) || "?"}`;
    s.byModel[mkey] = s.byModel[mkey] || { calls: 0, cost: 0, tokens: 0 };
    s.byModel[mkey].calls++;
    if (typeof entry.cost_usd === "number") s.byModel[mkey].cost += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.byModel[mkey].tokens += entry.total_tokens;
    await kv.put(skey, JSON.stringify(s), { expirationTtl: 90 * 24 * 3600 });
  } catch {
    // never break the request
  }
}

// Same parsing as the bot: a JSON array (or an object holding one), non-empty strings, first 6.
function parseThemes(text: string): string[] {
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === "object" ? Object.values(parsed).find((v) => Array.isArray(v)) : null) || [];
  return (list as unknown[])
    .map((t) => (t && typeof t === "object"
      ? (t as Record<string, unknown>).topic ?? (t as Record<string, unknown>).theme ?? (t as Record<string, unknown>).text ?? (t as Record<string, unknown>).content ?? ""
      : t ?? ""))
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 6);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: TestReq;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve config: inline > preset id > global > error
  let cfg: AiConfigInput | null = body.config ?? null;

  if (!cfg && body.usePresetId) {
    const presets = (await ctx.env.CHALLENGE_KV.get<AiConfigInput[]>("settings:ai:presets", "json")) ?? [];
    cfg = presets.find((p: any) => p.id === body.usePresetId) ?? null;
    if (!cfg) return json({ error: `Preset ${body.usePresetId} not found` }, { status: 404 });
  }

  if (!cfg && body.useGlobal) {
    cfg = (await ctx.env.CHALLENGE_KV.get("settings:ai:global", "json")) as AiConfigInput | null;
  }
  if (!cfg) return json({ error: "Provide config, usePresetId or useGlobal" }, { status: 400 });

  // A config without a typed key (preset/global come masked to the page) uses, in order:
  // the preset's own key, the global config's key, the provider's shared token.
  if (!typedKey(cfg.apiKey)) {
    cfg.apiKey = "";
    if (body.usePresetId) {
      const presets = (await ctx.env.CHALLENGE_KV.get<AiConfigInput[]>("settings:ai:presets", "json")) ?? [];
      const p = presets.find((x: any) => x.id === body.usePresetId);
      if (p?.apiKey) cfg.apiKey = p.apiKey;
    }
    if (!cfg.apiKey) {
      const stored = (await ctx.env.CHALLENGE_KV.get("settings:ai:global", "json")) as AiConfigInput | null;
      // Another provider's key would only produce a 401.
      if (stored?.apiKey && stored.provider === cfg.provider) cfg.apiKey = stored.apiKey;
    }
    if (!cfg.apiKey) {
      const shared = (await ctx.env.CHALLENGE_KV.get<Record<string, string>>(SHARED_TOKENS_KEY, "json")) ?? {};
      cfg.apiKey = shared[cfg.provider] ?? "";
    }
    if (!cfg.apiKey) {
      return json({ error: `apiKey не задан. Сохрани токен для ${cfg.provider} в секции TOKENS на /ai-engine` }, { status: 400 });
    }
  }

  // Применяем overrides — позволяет на странице AI Test выбрать другую модель
  // или температуру поверх сохранённого preset/global без пересохранения.
  if (body.modelOverride && body.modelOverride.trim()) cfg.model = body.modelOverride.trim();
  if (typeof body.temperatureOverride === "number") cfg.temperature = body.temperatureOverride;

  const type = body.type ?? "daily";
  const modes = body.modes ?? ["vanilla", "medium", "nsfw"];
  const prompts = await loadPrompts(ctx.env.CHALLENGE_KV);

  // Modes run in parallel; their log entries are written afterwards, one by one,
  // because logAiAttempt read-modify-writes the same KV keys.
  const logEntries: Record<string, unknown>[] = [];
  const results = await Promise.all(
    modes.map(async (mode) => {
      const startedAt = Date.now();
      try {
        const prompt = buildPrompt(prompts, mode, type);
        const { text, usage, raw } = await callAi(cfg!, prompt);
        const themes = parseThemes(text);
        const durationMs = Date.now() - startedAt;
        logEntries.push({
          provider: cfg!.provider, model: cfg!.model, source: "admin-test",
          resolvedModel: (raw as any)?.model ?? (raw as any)?.modelVersion ?? null,
          type, contentMode: mode, durationMs,
          success: themes.length === 6, themesCount: themes.length,
          prompt_tokens: (usage as any)?.prompt_tokens ?? null,
          completion_tokens: (usage as any)?.completion_tokens ?? null,
          total_tokens: (usage as any)?.total_tokens ?? null,
          cost_usd: (usage as any)?.total_cost ?? (usage as any)?.cost ?? null,
        });
        return {
          mode,
          ok: themes.length === 6,
          themes,
          rawText: text,
          durationMs,
          usage: usage ?? null,
          error: themes.length === 6 ? null : `Парсинг дал ${themes.length}/6 тем`,
        };
      } catch (e) {
        const durationMs = Date.now() - startedAt;
        logEntries.push({
          provider: cfg!.provider, model: cfg!.model, source: "admin-test",
          type, contentMode: mode, durationMs,
          success: false, error: String((e as Error).message || e).slice(0, 300),
        });
        return {
          mode,
          ok: false,
          themes: [],
          rawText: "",
          durationMs,
          usage: null,
          error: (e as Error).message,
        };
      }
    })
  );

  for (const entry of logEntries) await logAiAttempt(ctx.env.CHALLENGE_KV, entry);

  return json({
    ok: results.every((r) => r.ok),
    config: { provider: cfg.provider, model: cfg.model, temperature: cfg.temperature ?? null },
    type,
    results,
  });
};
