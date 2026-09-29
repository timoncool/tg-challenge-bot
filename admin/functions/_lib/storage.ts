// Mirror of bot's Storage class — read-only operations needed by admin Pages Functions.
// Keep key shapes IDENTICAL to worker-mr-challenger.js (see spec §4).

export type ChallengeType = "daily" | "weekly" | "monthly";

const SUBMISSION_LIMITS = { daily: 1, weekly: 3, monthly: 5 };
const DEFAULT_CONTENT_MODE = "vanilla";
const DEFAULT_MIN_SUGGESTION_REACTIONS = 3;
const defaultSchedule = {
  daily: { pollHour: 5, challengeHour: 17 },
  weekly: { pollDay: 6, pollHour: 10, challengeDay: 0, challengeHour: 17 },
  monthly: { pollDay: 28, pollHour: 10, challengeDay: 1, challengeHour: 17 },
};

export class AdminStorage {
  constructor(public kv: KVNamespace) {}

  private k(chatId: number, ...parts: (string | number)[]): string {
    return `community:${chatId}:${parts.join(":")}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return (await this.kv.get(key, "json")) as T | null;
  }

  async getCommunities(): Promise<Record<string, { chatId: number; name: string; addedAt: number }>> {
    return (await this.get("communities:list")) ?? {};
  }

  async getTopics(chatId: number) {
    return (
      (await this.get<{ daily: number; weekly: number; monthly: number; winners: number }>(
        this.k(chatId, "settings", "topics")
      )) ?? { daily: 0, weekly: 0, monthly: 0, winners: 0 }
    );
  }

  async getSchedule(chatId: number) {
    const stored = await this.get<typeof defaultSchedule>(this.k(chatId, "settings", "schedule"));
    return {
      daily: { ...defaultSchedule.daily, ...stored?.daily },
      weekly: { ...defaultSchedule.weekly, ...stored?.weekly },
      monthly: { ...defaultSchedule.monthly, ...stored?.monthly },
    };
  }

  async getContentMode(chatId: number) {
    return ((await this.get<string>(this.k(chatId, "settings", "content_mode"))) ??
      DEFAULT_CONTENT_MODE) as "vanilla" | "medium" | "nsfw";
  }

  async getAcceptLinks(chatId: number): Promise<boolean> {
    return (await this.get<boolean>(this.k(chatId, "settings", "accept_links"))) ?? false;
  }

  async getMinSuggestionReactions(chatId: number): Promise<number> {
    return (
      (await this.get<number>(this.k(chatId, "settings", "min_suggestion_reactions"))) ??
      DEFAULT_MIN_SUGGESTION_REACTIONS
    );
  }

  async getSubmissionLimits(chatId: number) {
    const v = await this.get<{ daily: number; weekly: number; monthly: number }>(
      this.k(chatId, "settings", "submission_limits")
    );
    return {
      daily: v?.daily ?? SUBMISSION_LIMITS.daily,
      weekly: v?.weekly ?? SUBMISSION_LIMITS.weekly,
      monthly: v?.monthly ?? SUBMISSION_LIMITS.monthly,
    };
  }

  async getChallenge(chatId: number, type: ChallengeType) {
    return await this.get<{
      id: number;
      type: ChallengeType;
      topic: string;
      topicFull: string;
      status: "active" | "finished";
      startedAt: number;
      endsAt: number;
      topicThreadId: number;
      announcementMessageId: number;
    }>(this.k(chatId, "challenge", type));
  }

  async getPoll(chatId: number, type: ChallengeType) {
    return await this.get<{
      type: ChallengeType;
      pollId: string;
      messageId: number;
      options: string[];
      createdAt: number;
      topicThreadId: number;
      suggestionIds?: string[];
    }>(this.k(chatId, "poll", type));
  }

  async getPollVotes(chatId: number, type: ChallengeType) {
    return await this.get<{ total: number; options: { text: string; votes: number }[] }>(
      this.k(chatId, "poll_votes", type)
    );
  }

  async getSubmissions(chatId: number, type: ChallengeType, challengeId: number) {
    return (
      (await this.get<
        { messageId: number; userId: number; username?: string; tgUsername?: string | null; score: number; timestamp: number }[]
      >(this.k(chatId, "submissions", type, challengeId))) ?? []
    );
  }

  async getSuggestions(chatId: number, type: ChallengeType) {
    return (
      (await this.get<
        {
          id: string;
          messageId: number;
          userId: number;
          username?: string;
          theme: string;
          createdAt: number;
          threadId: number;
          reactions: Record<string, 1>;
          reactionCount: number;
        }[]
      >(this.k(chatId, "suggestions", type))) ?? []
    );
  }

  async getLeaderboard(chatId: number, type: ChallengeType) {
    const map = (await this.get<Record<string, {
      userId: number;
      username?: string;
      wins: number;
      participations: number;
      lastWin?: number;
      lastParticipation?: number;
    }>>(this.k(chatId, "leaderboard", type))) ?? {};
    return Object.values(map).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.participations ?? 0) - (a.participations ?? 0);
    });
  }

  async getActiveTopics(chatId: number): Promise<Record<string, ChallengeType>> {
    return (await this.get(this.k(chatId, "active_topics"))) ?? {};
  }
}

type Slot = { day?: number; hour?: number; minute?: number };
type ScheduleEntry = {
  pollDay?: number; pollHour?: number; pollMinute?: number;
  challengeDay?: number; challengeHour?: number; challengeMinute?: number;
};

// Mirrors slotAt / lastSlotOccurrence / nextSlotOccurrence in worker-mr-challenger.js.
function slotAt(schedule: Record<ChallengeType, ScheduleEntry>, type: ChallengeType, action: "poll" | "challenge"): Slot {
  const s = schedule[type] ?? {};
  // Anything but an integer leaves the slot unscheduled, as in the bot.
  const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : undefined);
  if (action === "challenge") return { day: int(s.challengeDay), hour: int(s.challengeHour), minute: int(s.challengeMinute) ?? 0 };
  const minute = int(s.pollMinute) ?? 0;
  const challengeHour = int(s.challengeHour);
  const challengeDay = int(s.challengeDay);
  if (type === "daily") {
    return { hour: int(s.pollHour) ?? (challengeHour === undefined ? undefined : (challengeHour + 12) % 24), minute };
  }
  if (type === "weekly") {
    const day = int(s.pollDay) ?? (challengeDay === undefined ? undefined : (challengeDay + 6) % 7);
    return { day, hour: int(s.pollHour), minute };
  }
  const day = int(s.pollDay) ?? (challengeDay === undefined ? undefined : challengeDay === 1 ? 28 : challengeDay - 3);
  return { day, hour: int(s.pollHour), minute };
}

function lastSlotOccurrence(now: Date, kind: ChallengeType, { day, hour, minute }: Slot): number {
  const H = Number.isInteger(hour) ? hour! : 0;
  const M = Number.isInteger(minute) ? minute! : 0;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const at = new Date(Date.UTC(y, mo, now.getUTCDate(), H, M, 0, 0));
  if (kind === "daily") {
    if (at > now) at.setUTCDate(at.getUTCDate() - 1);
    return at.getTime();
  }
  if (kind === "weekly") {
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() - (day ?? 0) + 7) % 7));
    if (at > now) at.setUTCDate(at.getUTCDate() - 7);
    return at.getTime();
  }
  const dom = Math.min(Math.max(day ?? 1, 1), 28);
  const month = new Date(Date.UTC(y, mo, dom, H, M, 0, 0));
  return month > now ? Date.UTC(y, mo - 1, dom, H, M, 0, 0) : month.getTime();
}

function nextSlotOccurrence(after: Date, kind: ChallengeType, at: Slot): number {
  const next = new Date(lastSlotOccurrence(after, kind, at));
  if (kind === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (kind === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next.getTime();
}

/** Next poll and challenge instants for a type (UTC), exactly as the bot schedules them. */
export function nextOccurrence(now: Date, type: ChallengeType, schedule: Record<ChallengeType, ScheduleEntry>) {
  const out: { nextPollAt?: number; nextChallengeAt?: number } = {};
  const poll = slotAt(schedule, type, "poll");
  const challenge = slotAt(schedule, type, "challenge");
  if (Number.isInteger(poll.hour)) out.nextPollAt = nextSlotOccurrence(now, type, poll);
  if (Number.isInteger(challenge.hour)) out.nextChallengeAt = nextSlotOccurrence(now, type, challenge);
  return out;
}
