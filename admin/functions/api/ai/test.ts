import { Env, json } from "../../_lib/auth";
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

function buildPrompt(p: PromptsConfig, mode: "vanilla" | "medium" | "nsfw", type: string, sampleSize = 20) {
  const modeCfg = p.modes[mode];
  const sample = modeCfg.corpus.slice().sort(() => Math.random() - 0.5).slice(0, sampleSize);
  return p.template
    .replace(/\{TYPE\}/g, TYPE_NAMES[type] || "ДНЕВНОГО")
    .replace(/\{MODE\}/g, mode.toUpperCase())
    .replace(/\{INSTRUCTION\}/g, modeCfg.instruction)
    .replace(/\{SAMPLE\}/g, sample.join(", "))
    .replace(/\{HISTORY\}/g, "");
}

interface AiConfigInput {
  provider: "gemini" | "openai" | "openrouter" | "custom";
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  referer?: string;
  title?: string;
}

interface TestReq {
  config?: AiConfigInput;     // inline config
  useGlobal?: boolean;        // pull settings:ai:global from KV
  usePresetId?: string;       // pull a specific preset from settings:ai:presets
  type?: "daily" | "weekly" | "monthly";
  modes?: ("vanilla" | "medium" | "nsfw")[];
}

async function callAi(cfg: AiConfigInput, prompt: string): Promise<{ text: string; usage?: unknown; raw?: unknown }> {
  if (cfg.provider === "gemini") {
    const r = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: cfg.temperature ?? 0.95,
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
    const parts = j.candidates?.[0]?.content?.parts || [];
    let text = "";
    for (const p of parts) if (p.text && !p.thought) text = p.text;
    return { text, raw: j };
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
  // OpenRouter returns cost in usage only when explicitly asked
  if (cfg.provider === "openrouter") reqBody.usage = { include: true };
  const r = await fetch(cfg.apiUrl, { method: "POST", headers, body: JSON.stringify(reqBody) });
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

function parseThemes(text: string): string[] {
  if (!text) return [];
  try {
    const p = JSON.parse(text);
    return Array.isArray(p) ? p.slice(0, 6) : [];
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      try { const p = JSON.parse(m[0]); return Array.isArray(p) ? p.slice(0, 6) : []; }
      catch { return []; }
    }
  }
  return [];
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

  // Replace masked sentinel apiKey with stored value
  //   1) preset's own apiKey
  //   2) global config's apiKey
  //   3) shared secrets:ai:tokens[provider] — общий токен
  if (cfg.apiKey === "__UNCHANGED__" || !cfg.apiKey) {
    if (body.usePresetId) {
      const presets = (await ctx.env.CHALLENGE_KV.get<AiConfigInput[]>("settings:ai:presets", "json")) ?? [];
      const p = presets.find((x: any) => x.id === body.usePresetId);
      if (p?.apiKey) cfg.apiKey = p.apiKey;
    }
    if (cfg.apiKey === "__UNCHANGED__" || !cfg.apiKey) {
      const stored = (await ctx.env.CHALLENGE_KV.get("settings:ai:global", "json")) as AiConfigInput | null;
      if (stored?.apiKey) cfg.apiKey = stored.apiKey;
    }
    if (cfg.apiKey === "__UNCHANGED__" || !cfg.apiKey) {
      const shared = (await ctx.env.CHALLENGE_KV.get<{ openrouter?: string; gemini?: string }>("secrets:ai:tokens", "json")) ?? {};
      const t = (shared as any)[cfg.provider];
      if (t) cfg.apiKey = t;
    }
    if (cfg.apiKey === "__UNCHANGED__" || !cfg.apiKey) {
      return json({ error: `apiKey не задан. Сохрани токен для ${cfg.provider} в секции TOKENS на /ai-engine` }, { status: 400 });
    }
  }

  const type = body.type ?? "daily";
  const modes = body.modes ?? ["vanilla", "medium", "nsfw"];
  const prompts = await loadPrompts(ctx.env.CHALLENGE_KV);

  // Run all modes in parallel
  const results = await Promise.all(
    modes.map(async (mode) => {
      const startedAt = Date.now();
      try {
        const prompt = buildPrompt(prompts, mode, type);
        const { text, usage } = await callAi(cfg!, prompt);
        const themes = parseThemes(text);
        const durationMs = Date.now() - startedAt;
        await logAiAttempt(ctx.env.CHALLENGE_KV, {
          provider: cfg!.provider, model: cfg!.model, source: "admin-test",
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
        await logAiAttempt(ctx.env.CHALLENGE_KV, {
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

  return json({
    ok: results.every((r) => r.ok),
    config: { provider: cfg.provider, model: cfg.model, temperature: cfg.temperature ?? 0.95 },
    type,
    results,
  });
};
