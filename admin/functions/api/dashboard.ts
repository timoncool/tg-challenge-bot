import { Env, json } from "../_lib/auth";
import { AdminStorage, nextOccurrence, ChallengeType } from "../_lib/storage";

// The bot starts the next challenge at the minute the current one ends; it retries a failed
// start every 10 minutes. Past this grace an active challenge means its start is failing.
const OVERDUE_GRACE_MS = 15 * 60 * 1000;

const AI_CONFIG_FIELDS = ["provider", "apiUrl", "apiKey", "model"] as const;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const storage = new AdminStorage(ctx.env.CHALLENGE_KV);

  const communities = await storage.getCommunities();
  const list = Object.values(communities);
  const now = new Date();

  const cards = await Promise.all(
    list.map(async (c) => {
      const chatId = c.chatId;
      const [topics, schedule, contentMode, acceptLinks, submissionLimits] = await Promise.all([
        storage.getTopics(chatId),
        storage.getSchedule(chatId),
        storage.getContentMode(chatId),
        storage.getAcceptLinks(chatId),
        storage.getSubmissionLimits(chatId),
      ]);

      const perType: Record<ChallengeType, unknown> = { daily: null, weekly: null, monthly: null } as Record<ChallengeType, unknown>;
      const warnings: string[] = [];

      // Warn on missing topic configuration
      if (!topics.daily) warnings.push("Не настроена тема daily — пиши /set_daily в нужном треде");
      if (!topics.weekly) warnings.push("Не настроена тема weekly");
      if (!topics.monthly) warnings.push("Не настроена тема monthly");
      if (!topics.winners) warnings.push("Не настроена тема winners — победители не пересылаются");

      let overdue = false;
      for (const type of ["daily", "weekly", "monthly"] as ChallengeType[]) {
        const [challenge, poll, pollVotes] = await Promise.all([
          storage.getChallenge(chatId, type),
          storage.getPoll(chatId, type),
          storage.getPollVotes(chatId, type),
        ]);

        let state: "active" | "poll-open" | "idle" | "stale" = "idle";
        let participants: number | undefined;
        let submissionsCount: number | undefined;
        let lead: { username?: string; tgUsername?: string | null; userId: number; score: number } | undefined;

        if (challenge?.status === "active") {
          if (Date.now() > challenge.endsAt + OVERDUE_GRACE_MS) {
            state = "stale";
            overdue = true;
            const since = new Date(challenge.endsAt).toLocaleString("ru-RU", { timeZone: "UTC" });
            warnings.push(`${type}: следующий челлендж не стартовал, текущий просрочен с ${since} UTC — нажми «Перезапустить» и смотри Алерты`);
          } else {
            state = "active";
          }
          const submissions = await storage.getSubmissions(chatId, type, challenge.id);
          submissionsCount = submissions.length;
          participants = new Set(submissions.map((s) => s.userId)).size;
          if (submissions.length > 0) {
            const top = submissions.slice().sort((a, b) => b.score - a.score)[0];
            lead = { username: top.username, tgUsername: top.tgUsername, userId: top.userId, score: top.score };
          }
        } else if (poll) {
          state = "poll-open";
        }

        const nextTimes = state === "idle" ? nextOccurrence(now, type, schedule) : {};

        perType[type] = {
          state,
          challenge,
          poll,
          pollVotes,
          participants,
          submissionsCount,
          lead,
          ...nextTimes,
        };
      }

      // Suggestions ready/waiting
      const minReact = await storage.getMinSuggestionReactions(chatId);
      let ready = 0;
      let waiting = 0;
      for (const type of ["daily", "weekly", "monthly"] as ChallengeType[]) {
        const sugg = await storage.getSuggestions(chatId, type);
        for (const s of sugg) {
          if ((s.reactionCount ?? 0) >= minReact) ready++;
          else waiting++;
        }
      }

      // The engine the bot actually uses: an incomplete override is skipped by the bot too.
      type StoredAi = { name?: string } & Partial<Record<(typeof AI_CONFIG_FIELDS)[number], string>>;
      const complete = (cfg: StoredAi | null) => !!cfg && AI_CONFIG_FIELDS.every((f) => cfg[f]);
      const aiOverride = await storage.get<StoredAi>(`community:${chatId}:settings:ai`);
      const aiGlobal = await storage.get<StoredAi>(`settings:ai:global`);
      const aiConfigName = complete(aiOverride)
        ? aiOverride!.name ?? "community"
        : complete(aiGlobal)
          ? `${aiGlobal!.name ?? "global"}${aiOverride ? " (override сообщества неполный — пропущен)" : ""}`
          : "env (legacy)";

      // An overdue challenge means the schedule did not fire: that is broken, not a warning.
      const health: "healthy" | "warning" | "broken" =
        warnings.length === 0 ? "healthy" : overdue || warnings.length > 2 ? "broken" : "warning";

      return {
        community: c,
        topics,
        contentMode,
        acceptLinks,
        submissionLimits,
        schedule,
        health,
        warnings,
        aiConfigName,
        pendingSuggestions: { ready, waiting },
        perType,
      };
    })
  );

  return json({
    serverTime: Date.now(),
    communities: cards,
  });
};
