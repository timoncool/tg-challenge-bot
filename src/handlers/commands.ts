// ============================================
// Command Handlers
// /start, /help, /stats, /leaderboard, /current
// ============================================

import type { Context } from "grammy";
import type { Env, BotConfig, ChallengeType } from "../types";
import { StorageService } from "../services/storage";
import { getLocalization } from "../localization";

export async function handleStart(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const l = getLocalization(config.language);
  await ctx.reply(l.helpMessage);
}

export async function handleHelp(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const l = getLocalization(config.language);
  await ctx.reply(l.helpMessage);
}

export async function handleStats(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  // Get stats for all challenge types
  const dailyStats = await storage.getUserStats("daily", userId);
  const weeklyStats = await storage.getUserStats("weekly", userId);
  const monthlyStats = await storage.getUserStats("monthly", userId);

  const totalWins = dailyStats.wins + weeklyStats.wins + monthlyStats.wins;

  const message =
    config.language === "ru"
      ? `📊 Ваша статистика:

🏆 Всего побед: ${totalWins}

📅 Дневные челленджи:
   Побед: ${dailyStats.wins} | Место: #${dailyStats.rank}

📆 Недельные челленджи:
   Побед: ${weeklyStats.wins} | Место: #${weeklyStats.rank}

📆 Месячные челленджи:
   Побед: ${monthlyStats.wins} | Место: #${monthlyStats.rank}`
      : `📊 Your statistics:

🏆 Total wins: ${totalWins}

📅 Daily challenges:
   Wins: ${dailyStats.wins} | Rank: #${dailyStats.rank}

📆 Weekly challenges:
   Wins: ${weeklyStats.wins} | Rank: #${weeklyStats.rank}

📆 Monthly challenges:
   Wins: ${monthlyStats.wins} | Rank: #${monthlyStats.rank}`;

  await ctx.reply(message);
}

export async function handleLeaderboard(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  // Default to daily leaderboard
  const type: ChallengeType = "daily";
  const leaderboard = await storage.getLeaderboard(type);

  if (leaderboard.length === 0) {
    await ctx.reply(
      config.language === "ru"
        ? "🏆 Рейтинг пока пуст. Станьте первым победителем!"
        : "🏆 Leaderboard is empty. Be the first winner!"
    );
    return;
  }

  const top10 = leaderboard.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];

  let message = l.leaderboardTitle(type) + "\n\n";

  top10.forEach((entry, index) => {
    const medal = medals[index] || `${index + 1}.`;
    const name = entry.username || `User ${entry.userId}`;
    message += `${medal} ${name} — ${entry.wins} 🏆\n`;
  });

  await ctx.reply(message);
}

export async function handleCurrent(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  const daily = await storage.getChallenge("daily");
  const weekly = await storage.getChallenge("weekly");
  const monthly = await storage.getChallenge("monthly");

  const formatChallenge = (
    challenge: Awaited<ReturnType<typeof storage.getChallenge>>,
    type: ChallengeType
  ): string => {
    if (!challenge || challenge.status !== "active") {
      return config.language === "ru"
        ? `${l.challengeTypes[type]}: Нет активного`
        : `${l.challengeTypes[type]}: None active`;
    }

    const endDate = new Date(challenge.endsAt);
    const timeLeft = challenge.endsAt - Date.now();
    const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

    return config.language === "ru"
      ? `${l.challengeTypes[type]}:
   🎨 "${challenge.topic}"
   ⏰ Осталось: ${hoursLeft} ч.`
      : `${l.challengeTypes[type]}:
   🎨 "${challenge.topic}"
   ⏰ Time left: ${hoursLeft} h.`;
  };

  const message =
    config.language === "ru"
      ? `📋 Текущие челленджи:\n\n${formatChallenge(daily, "daily")}\n\n${formatChallenge(weekly, "weekly")}\n\n${formatChallenge(monthly, "monthly")}`
      : `📋 Current challenges:\n\n${formatChallenge(daily, "daily")}\n\n${formatChallenge(weekly, "weekly")}\n\n${formatChallenge(monthly, "monthly")}`;

  await ctx.reply(message);
}
