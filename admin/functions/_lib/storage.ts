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
        { messageId: number; userId: number; username?: string; score: number; timestamp: number }[]
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

/** Compute next poll/challenge time given a schedule entry (UTC). */
export function nextOccurrence(now: Date, type: ChallengeType, schedule: ReturnType<AdminStorage["getSchedule"]> extends Promise<infer S> ? S : never) {
  const utc = new Date(now.toISOString());
  const out: { nextPollAt?: number; nextChallengeAt?: number } = {};

  if (type === "daily") {
    const challengeHour = schedule.daily.challengeHour;
    const pollHour = (challengeHour - 12 + 24) % 24;
    out.nextPollAt = nextHourUtc(utc, pollHour);
    out.nextChallengeAt = nextHourUtc(utc, challengeHour);
  } else if (type === "weekly") {
    out.nextPollAt = nextDayOfWeekUtc(
      utc,
      (schedule.weekly.challengeDay + 6) % 7,
      schedule.weekly.pollHour ?? 10
    );
    out.nextChallengeAt = nextDayOfWeekUtc(
      utc,
      schedule.weekly.challengeDay ?? 0,
      schedule.weekly.challengeHour
    );
  } else if (type === "monthly") {
    const pollDay = (schedule.monthly.challengeDay ?? 1) === 1 ? 28 : (schedule.monthly.challengeDay ?? 1) - 3;
    out.nextPollAt = nextDayOfMonthUtc(utc, pollDay, schedule.monthly.pollHour ?? 10);
    out.nextChallengeAt = nextDayOfMonthUtc(
      utc,
      schedule.monthly.challengeDay ?? 1,
      schedule.monthly.challengeHour
    );
  }
  return out;
}

function nextHourUtc(now: Date, hour: number): number {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(hour);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

function nextDayOfWeekUtc(now: Date, weekday: number, hour: number): number {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(hour);
  const diff = (weekday - d.getUTCDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCDate(d.getUTCDate() + diff);
  return d.getTime();
}

function nextDayOfMonthUtc(now: Date, day: number, hour: number): number {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(hour);
  d.setUTCDate(day);
  if (d.getTime() <= now.getTime()) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(day);
  }
  return d.getTime();
}
