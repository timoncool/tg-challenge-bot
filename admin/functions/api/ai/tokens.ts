import { Env, json } from "../../_lib/auth";
import { maskKey, SENTINEL_UNCHANGED, SHARED_TOKENS_KEY } from "../../_lib/aiKeys";

// Shared AI tokens for the whole admin / bot, one KV key: { openrouter?: string, gemini?: string }.
// Configs saved without their own key copy the provider's token — the bot reads only the copy —
// so a changed token is written into every config that still holds the previous one.

type Tokens = { openrouter?: string; gemini?: string };
type StoredConfig = { provider?: string; apiKey?: string };

// Migrate-on-read: первые запросы после введения shared-tokens видят пустой
// secrets:ai:tokens, но токены УЖЕ лежат в settings:ai:presets[*].apiKey
// и в settings:ai:global.apiKey. Авто-импортируем их сюда чтобы UI сразу
// показывал «сохранён».
async function readWithMigration(ctx: { env: Env }): Promise<Tokens> {
  const t = (await ctx.env.CHALLENGE_KV.get<Tokens>(SHARED_TOKENS_KEY, "json")) ?? {};
  const need = { openrouter: !t.openrouter, gemini: !t.gemini };
  if (!need.openrouter && !need.gemini) return t;

  const next: Tokens = { ...t };
  const presets = (await ctx.env.CHALLENGE_KV.get<StoredConfig[]>("settings:ai:presets", "json")) ?? [];
  for (const p of presets) {
    if (need.openrouter && p.provider === "openrouter" && p.apiKey) { next.openrouter = p.apiKey; need.openrouter = false; }
    if (need.gemini     && p.provider === "gemini"     && p.apiKey) { next.gemini     = p.apiKey; need.gemini     = false; }
    if (!need.openrouter && !need.gemini) break;
  }
  if (need.openrouter || need.gemini) {
    const g = await ctx.env.CHALLENGE_KV.get<StoredConfig>("settings:ai:global", "json");
    if (g?.apiKey && g.provider) {
      if (need.openrouter && g.provider === "openrouter") next.openrouter = g.apiKey;
      if (need.gemini     && g.provider === "gemini")     next.gemini     = g.apiKey;
    }
  }
  // Persist only if anything was actually filled
  if (next.openrouter !== t.openrouter || next.gemini !== t.gemini) {
    await ctx.env.CHALLENGE_KV.put(SHARED_TOKENS_KEY, JSON.stringify(next));
  }
  return next;
}

/** Replace `oldToken` with `newToken` in every stored config of `provider` that holds it. */
async function propagateToken(kv: KVNamespace, provider: string, oldToken: string, newToken: string): Promise<number> {
  let updated = 0;
  const swap = (cfg: StoredConfig | null) => {
    if (cfg?.provider !== provider || cfg.apiKey !== oldToken) return false;
    cfg.apiKey = newToken;
    updated++;
    return true;
  };

  const global = await kv.get<StoredConfig>("settings:ai:global", "json");
  if (swap(global)) await kv.put("settings:ai:global", JSON.stringify(global));

  const presets = (await kv.get<StoredConfig[]>("settings:ai:presets", "json")) ?? [];
  if (presets.map(swap).some(Boolean)) await kv.put("settings:ai:presets", JSON.stringify(presets));

  const communities = (await kv.get<Record<string, unknown>>("communities:list", "json")) ?? {};
  for (const chatId of Object.keys(communities)) {
    const key = `community:${chatId}:settings:ai`;
    const cfg = await kv.get<StoredConfig>(key, "json");
    if (swap(cfg)) await kv.put(key, JSON.stringify(cfg));
  }
  return updated;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const t = await readWithMigration(ctx);
  return json({
    openrouter: { hasToken: !!t.openrouter, masked: maskKey(t.openrouter) },
    gemini:     { hasToken: !!t.gemini,     masked: maskKey(t.gemini) },
  });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  let body: { openrouter?: string; gemini?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const cur = (await ctx.env.CHALLENGE_KV.get<Tokens>(SHARED_TOKENS_KEY, "json")) ?? {};
  const next: Tokens = { ...cur };
  if (body.openrouter !== undefined && body.openrouter !== SENTINEL_UNCHANGED) next.openrouter = body.openrouter || undefined;
  if (body.gemini     !== undefined && body.gemini     !== SENTINEL_UNCHANGED) next.gemini     = body.gemini     || undefined;
  await ctx.env.CHALLENGE_KV.put(SHARED_TOKENS_KEY, JSON.stringify(next));

  let updatedConfigs = 0;
  for (const provider of ["openrouter", "gemini"] as const) {
    const was = cur[provider];
    const now = next[provider];
    if (was && now && was !== now) {
      updatedConfigs += await propagateToken(ctx.env.CHALLENGE_KV, provider, was, now);
    }
  }
  return json({
    ok: true,
    updatedConfigs,
    openrouter: { hasToken: !!next.openrouter, masked: maskKey(next.openrouter) },
    gemini:     { hasToken: !!next.gemini,     masked: maskKey(next.gemini) },
  });
};
