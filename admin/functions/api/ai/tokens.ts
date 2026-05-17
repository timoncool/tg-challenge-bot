import { Env, json } from "../../_lib/auth";

// Shared AI tokens for the whole admin / bot. Stored under one KV key so
// the user manages them in ONE place; preset/global configs that omit their
// own apiKey transparently inherit the matching provider token.
//
// KV shape:  secrets:ai:tokens  =>  { openrouter?: string, gemini?: string }

const KEY = "secrets:ai:tokens";

type Tokens = { openrouter?: string; gemini?: string };

function mask(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}

// Migrate-on-read: первые запросы после введения shared-tokens видят пустой
// secrets:ai:tokens, но токены УЖЕ лежат в settings:ai:presets[*].apiKey
// и в settings:ai:global.apiKey. Авто-импортируем их сюда чтобы UI сразу
// показывал «сохранён».
async function readWithMigration(ctx: { env: Env }): Promise<Tokens> {
  const t = (await ctx.env.CHALLENGE_KV.get<Tokens>(KEY, "json")) ?? {};
  const need = { openrouter: !t.openrouter, gemini: !t.gemini };
  if (!need.openrouter && !need.gemini) return t;

  const next: Tokens = { ...t };
  if (need.openrouter || need.gemini) {
    const presets = (await ctx.env.CHALLENGE_KV.get<Array<{ provider: string; apiKey?: string }>>("settings:ai:presets", "json")) ?? [];
    for (const p of presets) {
      if (need.openrouter && p.provider === "openrouter" && p.apiKey) { next.openrouter = p.apiKey; need.openrouter = false; }
      if (need.gemini     && p.provider === "gemini"     && p.apiKey) { next.gemini     = p.apiKey; need.gemini     = false; }
      if (!need.openrouter && !need.gemini) break;
    }
  }
  if (need.openrouter || need.gemini) {
    const g = (await ctx.env.CHALLENGE_KV.get<{ provider?: string; apiKey?: string }>("settings:ai:global", "json"));
    if (g?.apiKey && g.provider) {
      if (need.openrouter && g.provider === "openrouter") { next.openrouter = g.apiKey; need.openrouter = false; }
      if (need.gemini     && g.provider === "gemini")     { next.gemini     = g.apiKey; need.gemini     = false; }
    }
  }
  // Persist only if anything was actually filled
  if (next.openrouter !== t.openrouter || next.gemini !== t.gemini) {
    await ctx.env.CHALLENGE_KV.put(KEY, JSON.stringify(next));
  }
  return next;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const t = await readWithMigration(ctx);
  return json({
    openrouter: { hasToken: !!t.openrouter, masked: mask(t.openrouter) },
    gemini:     { hasToken: !!t.gemini,     masked: mask(t.gemini) },
  });
};

const SENTINEL = "__UNCHANGED__";

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  let body: { openrouter?: string; gemini?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const cur = (await ctx.env.CHALLENGE_KV.get<Tokens>(KEY, "json")) ?? {};
  const next: Tokens = { ...cur };
  if (body.openrouter !== undefined && body.openrouter !== SENTINEL) next.openrouter = body.openrouter || undefined;
  if (body.gemini     !== undefined && body.gemini     !== SENTINEL) next.gemini     = body.gemini     || undefined;
  await ctx.env.CHALLENGE_KV.put(KEY, JSON.stringify(next));
  return json({
    ok: true,
    openrouter: { hasToken: !!next.openrouter, masked: mask(next.openrouter) },
    gemini:     { hasToken: !!next.gemini,     masked: mask(next.gemini) },
  });
};
