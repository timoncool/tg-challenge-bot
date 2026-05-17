import { Env, json } from "../_lib/auth";
import { AdminStorage, nextOccurrence, ChallengeType } from "../_lib/storage";

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

      for (const type of ["daily", "weekly", "monthly"] as ChallengeType[]) {
        const [challenge, poll, pollVotes] = await Promise.all([
          storage.getChallenge(chatId, type),
          storage.getPoll(chatId, type),
          storage.getPollVotes(chatId, type),
        ]);

        let state: "active" | "poll-open" | "idle" | "stale" = "idle";
        let participants: number | undefined;
        let submissionsCount: number | undefined;
        let lead: { username?: string; userId: number; score: number } | undefined;

        if (challenge?.status === "active") {
          if (Date.now() > challenge.endsAt) {
            state = "stale";
            warnings.push(`${type}: челлендж просрочен с ${new Date(challenge.endsAt).toLocaleString("ru-RU")} — нажми Finish`);
          } else {
            state = "active";
          }
          const submissions = await storage.getSubmissions(chatId, type, challenge.id);
          submissionsCount = submissions.length;
          participants = new Set(submissions.map((s) => s.userId)).size;
          if (submissions.length > 0) {
            const top = submissions.slice().sort((a, b) => b.score - a.score)[0];
            lead = { username: top.username, userId: top.userId, score: top.score };
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

      // Resolve effective AI config name
      const aiOverride = await storage.get<{ name: string }>(`community:${chatId}:settings:ai`);
      const aiGlobal = await storage.get<{ name: string }>(`settings:ai:global`);
      const aiConfigName = aiOverride?.name ?? aiGlobal?.name ?? "env (legacy)";

      const health: "healthy" | "warning" | "broken" =
        warnings.length === 0 ? "healthy" : warnings.some((w) => w.startsWith("просрочен")) ? "warning" : warnings.length > 2 ? "broken" : "warning";

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
