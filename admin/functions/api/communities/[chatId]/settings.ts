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

// Integer ranges of the schedule fields the bot reads; anything else is rejected, because a
// non-integer value would silently switch the slot off.
type ScheduleField = "challengeDay" | "challengeHour" | "challengeMinute" | "pollDay" | "pollHour" | "pollMinute";
const TIME: Partial<Record<ScheduleField, [number, number]>> = {
  challengeHour: [0, 23], challengeMinute: [0, 59], pollHour: [0, 23], pollMinute: [0, 59],
};
const SCHEDULE_RANGES: Record<"daily" | "weekly" | "monthly", Partial<Record<ScheduleField, [number, number]>>> = {
  daily: TIME,
  weekly: { ...TIME, challengeDay: [0, 6], pollDay: [0, 6] },
  monthly: { ...TIME, challengeDay: [1, 28], pollDay: [1, 28] },
};

const isIntIn = (v: unknown, [min, max]: [number, number]) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

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

  // Validate everything first: a rejected field must not leave the others half-saved.
  if (body.contentMode !== undefined && !["vanilla", "medium", "nsfw"].includes(body.contentMode)) {
    return json({ error: "contentMode must be vanilla|medium|nsfw" }, { status: 400 });
  }
  if (body.minSuggestionReactions !== undefined && !isIntIn(body.minSuggestionReactions, [1, 50])) {
    return json({ error: "minSuggestionReactions: 1..50 integer" }, { status: 400 });
  }
  for (const t of ["daily", "weekly", "monthly"] as const) {
    const v = body.submissionLimits?.[t];
    if (v !== undefined && !isIntIn(v, [1, 20])) {
      return json({ error: `submissionLimits.${t}: 1..20 integer` }, { status: 400 });
    }
    for (const [field, value] of Object.entries(body.schedule?.[t] ?? {})) {
      const range = SCHEDULE_RANGES[t][field as ScheduleField];
      if (!range) return json({ error: `schedule.${t}.${field}: unknown field` }, { status: 400 });
      if (!isIntIn(value, range)) {
        return json({ error: `schedule.${t}.${field}: ${range[0]}..${range[1]} integer` }, { status: 400 });
      }
    }
  }

  const kv = ctx.env.CHALLENGE_KV;
  const k = (...p: (string | number)[]) => `community:${chatId}:${p.join(":")}`;
  const s = new AdminStorage(kv);

  if (body.contentMode) {
    await kv.put(k("settings", "content_mode"), JSON.stringify(body.contentMode));
  }
  if (typeof body.acceptLinks === "boolean") {
    await kv.put(k("settings", "accept_links"), JSON.stringify(body.acceptLinks));
  }
  if (body.minSuggestionReactions !== undefined) {
    await kv.put(k("settings", "min_suggestion_reactions"), JSON.stringify(body.minSuggestionReactions));
  }
  if (body.submissionLimits) {
    const cur = await s.getSubmissionLimits(chatId);
    await kv.put(k("settings", "submission_limits"), JSON.stringify({ ...cur, ...body.submissionLimits }));
  }
  if (body.schedule) {
    const cur = await s.getSchedule(chatId);
    const merged = {
      daily: { ...cur.daily, ...body.schedule.daily },
      weekly: { ...cur.weekly, ...body.schedule.weekly },
      monthly: { ...cur.monthly, ...body.schedule.monthly },
    };
    await kv.put(k("settings", "schedule"), JSON.stringify(merged));
  }

  return json({ ok: true });
};
