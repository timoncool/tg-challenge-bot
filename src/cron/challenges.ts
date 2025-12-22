// ============================================
// Challenge Lifecycle Cron Jobs
// Handles poll generation, challenge start/end
// ============================================

import { Bot, InlineKeyboard } from "grammy";
import type { Env, BotConfig, ChallengeType, Challenge } from "../types";
import { StorageService } from "../services/storage";
import { AIService } from "../services/ai";
import { getLocalization } from "../localization";

// ============================================
// Generate Poll for Upcoming Challenge
// ============================================

export async function generatePoll(
  bot: Bot,
  env: Env,
  config: BotConfig,
  type: ChallengeType
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const ai = new AIService(env.GEMINI_API_KEY);
  const l = getLocalization(config.language);

  // Check if there's already a poll
  const existingPoll = await storage.getPoll(type);
  if (existingPoll) {
    console.log(`Poll for ${type} already exists, skipping generation`);
    return;
  }

  // Get the topic ID for this challenge type
  const topicId = config.topics[type];

  // Get previous themes to avoid repetition
  const previousThemes = await storage.getThemeHistory(type);
  console.log(`Previous themes for ${type}:`, previousThemes);

  // Generate themes using AI (with history to avoid duplicates)
  console.log(`Generating themes for ${type} challenge...`);
  const themes = await ai.generateThemes(type, config.language, previousThemes);
  console.log(`Generated themes:`, themes);

  // Send poll to the topic
  let pollMessage;
  try {
    pollMessage = await bot.api.sendPoll(
      config.chatId,
      l.pollQuestion(type),
      themes,
      {
        message_thread_id: topicId || undefined,
        is_anonymous: false,
        allows_multiple_answers: false,
      }
    );
  } catch (error) {
    console.error(`Failed to send poll for ${type}:`, error);
    return; // Can't create poll, abort
  }

  // Save poll info
  await storage.savePoll({
    type,
    pollId: pollMessage.poll.id,
    messageId: pollMessage.message_id,
    options: themes,
    createdAt: Date.now(),
    topicThreadId: topicId,
  });

  console.log(`Poll created for ${type}: message_id=${pollMessage.message_id}`);
}

// ============================================
// Start Challenge (close poll, announce winner theme)
// ============================================

export async function startChallenge(
  bot: Bot,
  env: Env,
  config: BotConfig,
  type: ChallengeType
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  // First, finish any existing active challenge
  await finishChallenge(bot, env, config, type);

  // Get the poll
  const poll = await storage.getPoll(type);

  if (!poll) {
    console.log(`No poll found for ${type}, using fallback theme`);
    // Use a fallback theme if no poll exists
    await startChallengeWithTheme(bot, env, config, type, "Свободная тема");
    return;
  }

  // Stop the poll and get results
  try {
    const stoppedPoll = await bot.api.stopPoll(config.chatId, poll.messageId);

    // Find the winning option
    let maxVotes = 0;
    let winningTheme = poll.options[0];

    for (const option of stoppedPoll.options) {
      if (option.voter_count > maxVotes) {
        maxVotes = option.voter_count;
        winningTheme = option.text;
      }
    }

    console.log(`Winning theme for ${type}: "${winningTheme}" with ${maxVotes} votes`);

    // Delete the poll from storage
    await storage.deletePoll(type);

    // Start challenge with winning theme
    await startChallengeWithTheme(bot, env, config, type, winningTheme);
  } catch (error) {
    console.error(`Error stopping poll:`, error);
    // Try to start with first option as fallback
    await startChallengeWithTheme(bot, env, config, type, poll.options[0]);
    await storage.deletePoll(type);
  }
}

async function startChallengeWithTheme(
  bot: Bot,
  env: Env,
  config: BotConfig,
  type: ChallengeType,
  theme: string
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  // Get topic ID
  const topicId = config.topics[type];

  // Calculate end time based on challenge type
  const now = Date.now();
  const durations: Record<ChallengeType, number> = {
    daily: 24 * 60 * 60 * 1000,      // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
    monthly: 28 * 24 * 60 * 60 * 1000, // ~28 days (will be adjusted by cron)
  };

  const endsAt = now + durations[type];
  const endDate = new Date(endsAt + config.timezoneOffset * 60 * 60 * 1000);

  // Format end time
  const endTimeStr = endDate.toLocaleString(
    config.language === "ru" ? "ru-RU" : "en-US",
    {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  // Create challenge
  const challengeId = await storage.getNextChallengeId(type);

  const challenge: Challenge = {
    id: challengeId,
    type,
    topic: theme,
    status: "active",
    startedAt: now,
    endsAt,
    topicThreadId: topicId,
  };

  // Send announcement
  try {
    const announcement = await bot.api.sendMessage(
      config.chatId,
      l.challengeAnnouncement(type, theme, endTimeStr),
      {
        message_thread_id: topicId || undefined,
      }
    );
    challenge.announcementMessageId = announcement.message_id;
  } catch (error) {
    console.error(`Failed to send challenge announcement for ${type}:`, error);
    // Continue without announcement - challenge will still work
  }

  // Save challenge
  await storage.saveChallenge(challenge);

  // Update active topics
  const activeTopics = await storage.getActiveTopics();
  activeTopics[topicId] = type;
  await storage.setActiveTopics(activeTopics);

  // Save theme to history (to avoid repetition in future)
  await storage.addThemeToHistory(type, theme);

  console.log(`Challenge started: ${type} #${challengeId} - "${theme}"`);
}

// ============================================
// Finish Challenge (count votes, announce winner)
// ============================================

export async function finishChallenge(
  bot: Bot,
  env: Env,
  config: BotConfig,
  type: ChallengeType
): Promise<void> {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config.language);

  // Get active challenge
  const challenge = await storage.getChallenge(type);

  if (!challenge || challenge.status !== "active") {
    console.log(`No active ${type} challenge to finish`);
    return;
  }

  // Get submissions
  const submissions = await storage.getSubmissions(type, challenge.id);

  if (submissions.length === 0) {
    // No submissions - just announce
    try {
      await bot.api.sendMessage(config.chatId, l.noSubmissions, {
        message_thread_id: challenge.topicThreadId || undefined,
      });
    } catch (error) {
      console.error(`Failed to send 'no submissions' message:`, error);
    }

    // Mark challenge as finished
    challenge.status = "finished";
    await storage.saveChallenge(challenge);

    // Remove from active topics
    const activeTopics = await storage.getActiveTopics();
    delete activeTopics[challenge.topicThreadId];
    await storage.setActiveTopics(activeTopics);

    return;
  }

  // Find winner (highest score)
  const sorted = [...submissions].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  console.log(`Winner of ${type} #${challenge.id}: user=${winner.userId}, score=${winner.score}`);

  // Announce winner in challenge topic
  const winnerName = winner.username
    ? `@${winner.username}`
    : `User #${winner.userId}`;

  try {
    await bot.api.sendMessage(
      config.chatId,
      l.winnerAnnouncement(winnerName, winner.score, type),
      {
        message_thread_id: challenge.topicThreadId || undefined,
        reply_to_message_id: winner.messageId,
      }
    );
  } catch (error) {
    console.error(`Failed to announce winner for ${type}:`, error);
    // Continue with leaderboard update anyway
  }

  // Forward winning submission to Winners topic
  if (config.topics.winners) {
    try {
      await bot.api.forwardMessage(
        config.chatId,
        config.chatId,
        winner.messageId,
        {
          message_thread_id: config.topics.winners,
        }
      );

      // Send context message in winners topic
      await bot.api.sendMessage(
        config.chatId,
        config.language === "ru"
          ? `🏆 Победитель ${l.challengeTypes[type]} #${challenge.id}\n👤 ${winnerName}\n🎨 Тема: "${challenge.topic}"\n⭐ Реакций: ${winner.score}`
          : `🏆 Winner of ${l.challengeTypes[type]} #${challenge.id}\n👤 ${winnerName}\n🎨 Theme: "${challenge.topic}"\n⭐ Reactions: ${winner.score}`,
        {
          message_thread_id: config.topics.winners,
        }
      );
    } catch (error) {
      console.error("Error forwarding to winners topic:", error);
    }
  }

  // Update leaderboard
  await storage.addWin(type, winner.userId, winner.username);

  // Mark challenge as finished
  challenge.status = "finished";
  await storage.saveChallenge(challenge);

  // Clear submissions after some delay (keep for reference)
  // await storage.clearSubmissions(type, challenge.id);

  // Remove from active topics
  const activeTopics = await storage.getActiveTopics();
  delete activeTopics[challenge.topicThreadId];
  await storage.setActiveTopics(activeTopics);

  console.log(`Challenge ${type} #${challenge.id} finished`);
}

// ============================================
// Cron Handler - Determines what action to take
// ============================================

export async function handleCron(
  bot: Bot,
  env: Env,
  config: BotConfig,
  cron: string
): Promise<void> {
  // Parse cron to determine action
  // Format: "minute hour day month weekday"
  const [minute, hour, day, month, weekday] = cron.split(" ");

  const hourNum = parseInt(hour, 10);
  const dayNum = parseInt(day, 10);
  const weekdayNum = parseInt(weekday, 10);

  console.log(`Cron triggered: ${cron}`);

  // DAILY CHALLENGES
  // 05:00 UTC (08:00 Moscow) - Generate poll
  if (hourNum === 5 && day === "*" && weekday === "*") {
    await generatePoll(bot, env, config, "daily");
    return;
  }

  // 17:00 UTC (20:00 Moscow) - Start daily + finish previous
  if (hourNum === 17 && day === "*" && weekday === "*") {
    await startChallenge(bot, env, config, "daily");
    return;
  }

  // WEEKLY CHALLENGES
  // Saturday 10:00 UTC - Generate poll
  if (hourNum === 10 && weekdayNum === 6) {
    await generatePoll(bot, env, config, "weekly");
    return;
  }

  // Sunday 17:00 UTC - Start weekly
  if (hourNum === 17 && weekdayNum === 0) {
    await startChallenge(bot, env, config, "weekly");
    return;
  }

  // MONTHLY CHALLENGES
  // 28th 10:00 UTC - Generate poll
  if (hourNum === 10 && dayNum === 28) {
    await generatePoll(bot, env, config, "monthly");
    return;
  }

  // 1st 17:00 UTC - Start monthly
  if (hourNum === 17 && dayNum === 1) {
    await startChallenge(bot, env, config, "monthly");
    return;
  }

  console.log(`Unknown cron pattern: ${cron}`);
}
