// ============================================
// TG Challenge Bot - Main Entry Point
// Cloudflare Workers + grammY
// ============================================

import { Bot, webhookCallback, Composer, BotError } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { limit } from "@grammyjs/ratelimiter";
import { Hono } from "hono";
import type { Env, BotConfig } from "./types";
import { handleSubmission } from "./handlers/submissions";
import { handleReactionCount } from "./handlers/reactions";
import {
  handleStart,
  handleHelp,
  handleStats,
  handleLeaderboard,
  handleCurrent,
} from "./handlers/commands";
import { handleCron } from "./cron/challenges";

// ============================================
// Configuration Helper
// ============================================

function getConfig(env: Env): BotConfig {
  return {
    chatId: parseInt(env.CHAT_ID, 10) || 0,
    topics: {
      daily: parseInt(env.TOPIC_DAILY, 10) || 0,
      weekly: parseInt(env.TOPIC_WEEKLY, 10) || 0,
      monthly: parseInt(env.TOPIC_MONTHLY, 10) || 0,
      winners: parseInt(env.TOPIC_WINNERS, 10) || 0,
    },
    timezoneOffset: parseInt(env.TIMEZONE_OFFSET, 10) || 0,
    language: env.BOT_LANGUAGE === "en" ? "en" : "ru",
  };
}

// ============================================
// Bot Setup
// ============================================

function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);
  const config = getConfig(env);

  // ============================================
  // Auto-retry plugin (handles 429 rate limits and network errors)
  // ============================================
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 10,
      rethrowInternalServerErrors: false, // retry on 500 errors too
      rethrowHttpErrors: false, // retry on network errors
    })
  );

  // ============================================
  // Rate limiting middleware (1 message per second per user)
  // ============================================
  bot.use(
    limit({
      timeFrame: 2000, // 2 seconds
      limit: 3, // allow 3 messages per timeFrame
      onLimitExceeded: async (ctx) => {
        console.log(`Rate limit exceeded for user: ${ctx.from?.id}`);
        // Silently ignore excessive requests
      },
      keyGenerator: (ctx) => {
        // Rate limit by user ID, or skip for system events
        return ctx.from?.id?.toString();
      },
    })
  );

  // ============================================
  // Error boundary for submission handlers
  // ============================================
  const submissionComposer = new Composer();
  submissionComposer.on("message:photo", (ctx) => handleSubmission(ctx, env, config));
  submissionComposer.on("message:document", (ctx) => handleSubmission(ctx, env, config));

  bot.errorBoundary(
    (err: BotError) => {
      console.error("Submission handler error:", err.message);
      // Don't crash on submission errors, just log them
    }
  ).use(submissionComposer);

  // ============================================
  // Error boundary for reaction handlers
  // ============================================
  const reactionComposer = new Composer();
  reactionComposer.on("message_reaction_count", (ctx) =>
    handleReactionCount(ctx, env, config)
  );

  bot.errorBoundary(
    (err: BotError) => {
      console.error("Reaction handler error:", err.message);
      // Don't crash on reaction errors, just log them
    }
  ).use(reactionComposer);

  // ============================================
  // Command handlers (with their own error boundary)
  // ============================================
  const commandComposer = new Composer();
  commandComposer.command("start", (ctx) => handleStart(ctx, env, config));
  commandComposer.command("help", (ctx) => handleHelp(ctx, env, config));
  commandComposer.command("stats", (ctx) => handleStats(ctx, env, config));
  commandComposer.command("leaderboard", (ctx) => handleLeaderboard(ctx, env, config));
  commandComposer.command("current", (ctx) => handleCurrent(ctx, env, config));

  bot.errorBoundary(
    async (err: BotError) => {
      console.error("Command handler error:", err.message);
      // Try to notify user about error
      try {
        await err.ctx.reply("An error occurred. Please try again later.");
      } catch {
        // Ignore if we can't reply
      }
    }
  ).use(commandComposer);

  // ============================================
  // Global error handler (fallback)
  // ============================================
  bot.catch((err) => {
    console.error("Unhandled bot error:", err);
  });

  return bot;
}

// ============================================
// Hono App (HTTP Handler)
// ============================================

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    bot: "TG Challenge Bot",
    version: "1.0.0",
  });
});

// Webhook endpoint
app.post("/webhook", async (c) => {
  const env = c.env;

  // Validate bot token is set
  if (!env.BOT_TOKEN) {
    return c.json({ error: "BOT_TOKEN not configured" }, 500);
  }

  try {
    const bot = createBot(env);
    const handler = webhookCallback(bot, "hono");
    return await handler(c);
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

// Setup endpoint - registers webhook with Telegram
app.get("/setup", async (c) => {
  const env = c.env;

  if (!env.BOT_TOKEN) {
    return c.json({ error: "BOT_TOKEN not configured" }, 500);
  }

  const bot = new Bot(env.BOT_TOKEN);
  const url = new URL(c.req.url);
  const webhookUrl = `${url.origin}/webhook`;

  try {
    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: [
        "message",
        "message_reaction",
        "message_reaction_count",
        "poll",
        "poll_answer",
      ],
    });

    return c.json({
      success: true,
      webhook_url: webhookUrl,
      message: "Webhook registered successfully!",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return c.json({ error: "Failed to set webhook" }, 500);
  }
});

// Info endpoint - shows current config (without secrets)
app.get("/info", (c) => {
  const env = c.env;
  const config = getConfig(env);

  return c.json({
    configured: !!env.BOT_TOKEN,
    chat_id: config.chatId,
    topics: config.topics,
    timezone_offset: config.timezoneOffset,
    language: config.language,
    gemini_configured: !!env.GEMINI_API_KEY,
  });
});

// ============================================
// Cloudflare Workers Export
// ============================================

export default {
  // HTTP fetch handler
  fetch: app.fetch,

  // Cron trigger handler
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Validate configuration
    if (!env.BOT_TOKEN || !env.CHAT_ID) {
      console.error("Bot not configured: missing BOT_TOKEN or CHAT_ID");
      return;
    }

    const bot = createBot(env);
    const config = getConfig(env);

    try {
      await handleCron(bot, env, config, event.cron);
    } catch (error) {
      console.error("Cron error:", error);
    }
  },
};
