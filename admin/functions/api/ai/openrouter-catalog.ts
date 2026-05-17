import { Env, json } from "../../_lib/auth";

interface OrModelRaw {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
}

interface OrModel {
  id: string;
  name: string;
  group: string;        // "anthropic", "google", "meta-llama", etc.
  modality: string;     // "text" | "multimodal" | "audio" | "image"
  context_length: number | null;
  prompt_price: number | null;     // $/1M tokens
  completion_price: number | null; // $/1M tokens
  free: boolean;
  description: string;
}

const CACHE_KEY = "cache:openrouter:models";
const CACHE_TTL = 24 * 3600;

function normalize(m: OrModelRaw): OrModel {
  const id = m.id;
  const [group] = id.split("/", 1);

  const inputMods = m.architecture?.input_modalities ?? [];
  let modality = "text";
  if (inputMods.includes("image") || inputMods.length > 1) modality = "multimodal";

  // OpenRouter prices are per-token; show as $/1M
  const ppt = m.pricing?.prompt ? parseFloat(m.pricing.prompt) : null;
  const cpt = m.pricing?.completion ? parseFloat(m.pricing.completion) : null;
  const prompt_price = ppt !== null && !isNaN(ppt) ? ppt * 1_000_000 : null;
  const completion_price = cpt !== null && !isNaN(cpt) ? cpt * 1_000_000 : null;

  return {
    id,
    name: m.name ?? id,
    group: group || "other",
    modality,
    context_length: m.context_length ?? null,
    prompt_price,
    completion_price,
    free: (prompt_price === 0 && completion_price === 0),
    description: (m.description ?? "").slice(0, 200),
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await ctx.env.CHALLENGE_KV.get<{ ts: number; models: OrModel[] }>(CACHE_KEY, "json");
    if (cached && Date.now() - cached.ts < CACHE_TTL * 1000) {
      return json({
        source: "cache",
        cachedAt: cached.ts,
        count: cached.models.length,
        models: cached.models,
        groups: groupSummary(cached.models),
      });
    }
  }

  const r = await fetch("https://openrouter.ai/api/v1/models");
  if (!r.ok) return json({ error: `OpenRouter API ${r.status}` }, { status: 502 });
  const j = (await r.json()) as { data: OrModelRaw[] };

  const models = (j.data || []).map(normalize).sort((a, b) => a.id.localeCompare(b.id));

  await ctx.env.CHALLENGE_KV.put(
    CACHE_KEY,
    JSON.stringify({ ts: Date.now(), models }),
    { expirationTtl: CACHE_TTL }
  );

  return json({
    source: "fresh",
    cachedAt: Date.now(),
    count: models.length,
    models,
    groups: groupSummary(models),
  });
};

function groupSummary(models: OrModel[]) {
  const map = new Map<string, number>();
  for (const m of models) map.set(m.group, (map.get(m.group) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count);
}
