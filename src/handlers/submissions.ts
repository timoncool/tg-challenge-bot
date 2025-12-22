// ============================================
// Submissions Handler
// Tracks images posted to challenge topics
// ============================================

import type { Context } from "grammy";
import type { Env, BotConfig } from "../types";
import { StorageService } from "../services/storage";

export async function handleSubmission(
  ctx: Context,
  env: Env,
  config: BotConfig
): Promise<void> {
  // Only process messages with photos or image documents
  const hasPhoto = ctx.message?.photo && ctx.message.photo.length > 0;
  const hasImageDoc =
    ctx.message?.document?.mime_type?.startsWith("image/");

  if (!hasPhoto && !hasImageDoc) {
    return;
  }

  // Check if message is in the correct chat
  const chatId = ctx.message?.chat?.id;
  if (chatId !== config.chatId) {
    return;
  }

  // Get the forum topic ID (thread_id)
  const threadId = ctx.message?.message_thread_id || 0;

  // Check if this topic has an active challenge
  const storage = new StorageService(env.CHALLENGE_KV);
  const challengeType = await storage.isActiveTopic(threadId);

  if (!challengeType) {
    return; // Not a challenge topic or no active challenge
  }

  // Get the active challenge
  const challenge = await storage.getChallenge(challengeType);

  if (!challenge || challenge.status !== "active") {
    return; // No active challenge
  }

  // Check if submission is within the challenge time
  const now = Date.now();
  if (now > challenge.endsAt) {
    return; // Challenge has ended
  }

  // Register the submission
  const userId = ctx.message?.from?.id;
  const username = ctx.message?.from?.username || ctx.message?.from?.first_name;
  const messageId = ctx.message?.message_id;

  if (!userId || !messageId) {
    return;
  }

  await storage.addSubmission(challengeType, challenge.id, {
    messageId,
    userId,
    username,
    score: 0,
    timestamp: now,
  });

  console.log(
    `Submission registered: user=${userId}, message=${messageId}, challenge=${challengeType}#${challenge.id}`
  );
}
