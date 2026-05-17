import { Env, json } from "../../_lib/auth";
import { DEFAULT_PROMPTS, PromptsConfig } from "../../_lib/defaultPrompts";

const KEY = "settings:ai:prompts";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const stored = await ctx.env.CHALLENGE_KV.get<PromptsConfig>(KEY, "json");
  if (stored) return json({ source: "kv", prompts: stored });
  return json({ source: "default", prompts: DEFAULT_PROMPTS });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  let body: Partial<PromptsConfig>;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.template || !body.modes) {
    return json({ error: "template and modes required" }, { status: 400 });
  }
  for (const mode of ["vanilla", "medium", "nsfw"] as const) {
    const m = body.modes[mode];
    if (!m || typeof m.instruction !== "string" || !Array.isArray(m.corpus)) {
      return json({ error: `modes.${mode} must have instruction (string) and corpus (array)` }, { status: 400 });
    }
  }
  // backup previous
  const prev = await ctx.env.CHALLENGE_KV.get(KEY);
  if (prev) await ctx.env.CHALLENGE_KV.put(`${KEY}:prev`, prev);
  await ctx.env.CHALLENGE_KV.put(KEY, JSON.stringify(body));
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const cur = await ctx.env.CHALLENGE_KV.get(KEY);
  if (cur) await ctx.env.CHALLENGE_KV.put(`${KEY}:prev`, cur);
  await ctx.env.CHALLENGE_KV.delete(KEY);
  return json({ ok: true });
};
