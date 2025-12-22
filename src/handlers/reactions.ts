// ============================================
// Reactions Handler
// Counts reactions on challenge submissions
// Excludes 🌚 (moon) as negative reaction
// ============================================

import type { Context } from "grammy";
import type { Env, BotConfig, ChallengeType } from "../types";
import { StorageService } from "../services/storage";

// The moon emoji to exclude from counting
const EXCLUDED_EMOJI = "🌚";

export async function handleReactionCount(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  const update = ctx.messageReactionCount;

  if (!update) {
    return;
  }

  // Check if it's our chat
  const chatId = update.chat.id;
  if (chatId !== config.chatId) {
    return;
  }

  const messageId = update.message_id;
  const reactions = update.reactions;

  // Calculate score excluding 🌚
  let totalScore = 0;

  for (const reaction of reactions) {
    // Handle emoji reactions
    if (reaction.type.type === "emoji") {
      const emoji = reaction.type.emoji;
      if (emoji !== EXCLUDED_EMOJI) {
        totalScore += reaction.total_count;
      }
    }
    // Handle custom emoji reactions (always count)
    else if (reaction.type.type === "custom_emoji") {
      totalScore += reaction.total_count;
    }
    // Handle paid reactions (always count)
    else if (reaction.type.type === "paid") {
      totalScore += reaction.total_count;
    }
  }

  // Find which challenge this message belongs to
  const storage = new StorageService(env.CHALLENGE_KV);

  // Check all challenge types
  const types: ChallengeType[] = ["daily", "weekly", "monthly"];

  for (const type of types) {
    const challenge = await storage.getChallenge(type);

    if (!challenge || challenge.status !== "active") {
      continue;
    }

    // Try to update the score
    await storage.updateSubmissionScore(
      type,
      challenge.id,
      messageId,
      totalScore
    );
  }

  console.log(`Reaction update: message=${messageId}, score=${totalScore}`);
}
