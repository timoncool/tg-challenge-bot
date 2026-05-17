import { Env, json } from "../_lib/auth";
import { DEFAULT_BOT_MESSAGES, BotMessages } from "../_lib/botMessages";

const KEY = "settings:messages";

// GET — все тексты из KV. При первом запросе автоматически сидит дефолтами.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  let stored = await ctx.env.CHALLENGE_KV.get<Partial<BotMessages>>(KEY, "json");
  let seeded = false;
  if (!stored) {
    await ctx.env.CHALLENGE_KV.put(KEY, JSON.stringify(DEFAULT_BOT_MESSAGES));
    stored = DEFAULT_BOT_MESSAGES;
    seeded = true;
  }
  return json({
    defaults: DEFAULT_BOT_MESSAGES,
    override: stored,
    effective: { ...DEFAULT_BOT_MESSAGES, ...stored },
    seeded,
  });
};

// PUT — partial merge with stored override. Untouched fields stay intact.
// Strict per-field type validation: malformed values never land in KV.
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  let body: Partial<BotMessages>;
  try { body = await ctx.request.json(); }
  catch { return json({ error: "Invalid JSON" }, { status: 400 }); }

  // Array fields
  for (const k of ["submissionReactions", "winnerPhrases"] as const) {
    if (k in body) {
      const v = (body as Record<string, unknown>)[k];
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
        return json({ error: `${k} must be string[]` }, { status: 400 });
      }
    }
  }
  // Object-of-strings fields
  for (const k of ["challengeAnnouncementTitles", "challengeTypeTitles", "leaderboardLabels"] as const) {
    if (k in body) {
      const v = (body as Record<string, unknown>)[k];
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        return json({ error: `${k} must be {daily, weekly, monthly}` }, { status: 400 });
      }
      for (const sub of ["daily", "weekly", "monthly"] as const) {
        const sv = (v as Record<string, unknown>)[sub];
        if (sv !== undefined && typeof sv !== "string") {
          return json({ error: `${k}.${sub} must be string` }, { status: 400 });
        }
      }
    }
  }
  // String template fields
  for (const k of [
    "pollQuestion", "challengeAnnouncementTemplate", "winnerAnnouncementTemplate",
    "winnerAnnouncementFullTemplate", "noSubmissions", "submissionLimitReached",
    "leaderboardTitle", "helpMessage",
  ] as const) {
    if (k in body && typeof (body as Record<string, unknown>)[k] !== "string") {
      return json({ error: `${k} must be string` }, { status: 400 });
    }
  }

  // Merge with previous (do NOT overwrite untouched fields)
  const prev = (await ctx.env.CHALLENGE_KV.get<Partial<BotMessages>>(KEY, "json")) ?? {};
  const merged: Partial<BotMessages> = { ...prev, ...body };

  // Backup raw previous string
  const prevRaw = await ctx.env.CHALLENGE_KV.get(KEY);
  if (prevRaw) await ctx.env.CHALLENGE_KV.put(`${KEY}:prev`, prevRaw);
  await ctx.env.CHALLENGE_KV.put(KEY, JSON.stringify(merged));
  return json({ ok: true, mergedKeys: Object.keys(merged).length });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const cur = await ctx.env.CHALLENGE_KV.get(KEY);
  if (cur) await ctx.env.CHALLENGE_KV.put(`${KEY}:prev`, cur);
  await ctx.env.CHALLENGE_KV.delete(KEY);
  return json({ ok: true });
};
