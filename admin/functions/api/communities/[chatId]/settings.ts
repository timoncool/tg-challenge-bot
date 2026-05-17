import { Env, json } from "../../../_lib/auth";
import { AdminStorage } from "../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

interface SettingsPayload {
  contentMode?: "vanilla" | "medium" | "nsfw";
  acceptLinks?: boolean;
  minSuggestionReactions?: number;
  submissionLimits?: { daily?: number; weekly?: number; monthly?: number };
  schedule?: {
    daily?:   { challengeHour?: number; challengeMinute?: number; pollHour?: number; pollMinute?: number };
    weekly?:  { challengeDay?: number; challengeHour?: number; challengeMinute?: number; pollDay?: number; pollHour?: number; pollMinute?: number };
    monthly?: { challengeDay?: number; challengeHour?: number; challengeMinute?: number; pollDay?: number; pollHour?: number; pollMinute?: number };
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const chatId = parseInt(ctx.params.chatId as string, 10);
  if (!Number.isFinite(chatId)) return json({ error: "Invalid chatId" }, { status: 400 });

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);
  const communities = await s.getCommunities();
  const community = communities[String(chatId)];
  if (!community) return json({ error: "Community not registered" }, { status: 404 });

  const [topics, schedule, contentMode, acceptLinks, minSuggestionReactions, submissionLimits] = await Promise.all([
    s.getTopics(chatId),
    s.getSchedule(chatId),
    s.getContentMode(chatId),
    s.getAcceptLinks(chatId),
    s.getMinSuggestionReactions(chatId),
    s.getSubmissionLimits(chatId),
  ]);

  return json({
    community,
    topics,
    schedule,
    contentMode,
    acceptLinks,
    minSuggestionReactions,
    submissionLimits,
  });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  let body: SettingsPayload;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kv = ctx.env.CHALLENGE_KV;
  const k = (...p: (string | number)[]) => `community:${chatId}:${p.join(":")}`;

  // content mode
  if (body.contentMode) {
    if (!["vanilla", "medium", "nsfw"].includes(body.contentMode)) {
      return json({ error: "contentMode must be vanilla|medium|nsfw" }, { status: 400 });
    }
    await kv.put(k("settings", "content_mode"), JSON.stringify(body.contentMode));
  }

  // accept links
  if (typeof body.acceptLinks === "boolean") {
    await kv.put(k("settings", "accept_links"), JSON.stringify(body.acceptLinks));
  }

  // min suggestion reactions
  if (typeof body.minSuggestionReactions === "number") {
    const n = body.minSuggestionReactions;
    if (n < 1 || n > 50 || !Number.isInteger(n)) {
      return json({ error: "minSuggestionReactions: 1..50 integer" }, { status: 400 });
    }
    await kv.put(k("settings", "min_suggestion_reactions"), JSON.stringify(n));
  }

  // submission limits — merge partial
  if (body.submissionLimits) {
    const s = new AdminStorage(kv);
    const cur = await s.getSubmissionLimits(chatId);
    for (const t of ["daily", "weekly", "monthly"] as const) {
      const v = body.submissionLimits[t];
      if (v !== undefined) {
        if (!Number.isInteger(v) || v < 1 || v > 20) {
          return json({ error: `submissionLimits.${t}: 1..20 integer` }, { status: 400 });
        }
        cur[t] = v;
      }
    }
    await kv.put(k("settings", "submission_limits"), JSON.stringify(cur));
  }

  // schedule — merge partial preserving fields the bot expects
  if (body.schedule) {
    const s = new AdminStorage(kv);
    const cur = await s.getSchedule(chatId);
    const merged: Record<string, any> = { ...cur };
    for (const t of ["daily", "weekly", "monthly"] as const) {
      const patch = body.schedule[t];
      if (!patch) continue;
      merged[t] = { ...merged[t], ...patch };

      if (patch.challengeHour !== undefined) {
        const h = patch.challengeHour;
        if (h < 0 || h > 23) return json({ error: `schedule.${t}.challengeHour: 0..23` }, { status: 400 });
      }
      if ((patch as any).challengeMinute !== undefined) {
        const mi = (patch as any).challengeMinute as number;
        if (!Number.isInteger(mi) || mi < 0 || mi > 59) {
          return json({ error: `schedule.${t}.challengeMinute: 0..59 integer` }, { status: 400 });
        }
      }
      if ((patch as any).pollHour !== undefined) {
        const h = (patch as any).pollHour as number;
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          return json({ error: `schedule.${t}.pollHour: 0..23 integer` }, { status: 400 });
        }
      }
      if ((patch as any).pollMinute !== undefined) {
        const mi = (patch as any).pollMinute as number;
        if (!Number.isInteger(mi) || mi < 0 || mi > 59) {
          return json({ error: `schedule.${t}.pollMinute: 0..59 integer` }, { status: 400 });
        }
      }
      if (t === "weekly" && body.schedule.weekly?.challengeDay !== undefined) {
        const d = body.schedule.weekly.challengeDay;
        if (d < 0 || d > 6) return json({ error: "schedule.weekly.challengeDay: 0..6" }, { status: 400 });
      }
      if (t === "weekly" && body.schedule.weekly?.pollDay !== undefined) {
        const d = body.schedule.weekly.pollDay;
        if (!Number.isInteger(d) || d < 0 || d > 6) {
          return json({ error: "schedule.weekly.pollDay: 0..6 integer" }, { status: 400 });
        }
      }
      if (t === "monthly" && body.schedule.monthly?.challengeDay !== undefined) {
        const d = body.schedule.monthly.challengeDay;
        if (d < 1 || d > 28) return json({ error: "schedule.monthly.challengeDay: 1..28" }, { status: 400 });
      }
      if (t === "monthly" && body.schedule.monthly?.pollDay !== undefined) {
        const d = body.schedule.monthly.pollDay;
        if (!Number.isInteger(d) || d < 1 || d > 28) {
          return json({ error: "schedule.monthly.pollDay: 1..28 integer" }, { status: 400 });
        }
      }
    }
    await kv.put(k("settings", "schedule"), JSON.stringify(merged));
  }

  return json({ ok: true });
};
