// ============================================
// Type Definitions for TG Challenge Bot
// ============================================

export interface Env {
  // KV Storage
  CHALLENGE_KV: KVNamespace;

  // Secrets (set via wrangler secret put)
  BOT_TOKEN: string;
  GEMINI_API_KEY: string;

  // Public config (set in wrangler.toml)
  CHAT_ID: string;
  TOPIC_DAILY: string;
  TOPIC_WEEKLY: string;
  TOPIC_MONTHLY: string;
  TOPIC_WINNERS: string;
  TIMEZONE_OFFSET: string;
  BOT_LANGUAGE: string;
}

export type ChallengeType = "daily" | "weekly" | "monthly";

export type ChallengeStatus = "voting" | "active" | "finished";

export interface Challenge {
  id: number;
  type: ChallengeType;
  topic: string;
  status: ChallengeStatus;
  startedAt: number;      // Unix timestamp
  endsAt: number;         // Unix timestamp
  announcementMessageId?: number;
  topicThreadId: number;  // Forum topic ID
}

export interface Poll {
  type: ChallengeType;
  pollId: string;
  messageId: number;
  options: string[];
  createdAt: number;
  topicThreadId: number;
}

export interface Submission {
  messageId: number;
  userId: number;
  username?: string;
  score: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  userId: number;
  username?: string;
  wins: number;
  lastWin?: number;
}

export interface BotConfig {
  chatId: number;
  topics: {
    daily: number;
    weekly: number;
    monthly: number;
    winners: number;
  };
  timezoneOffset: number;
  language: "ru" | "en";
}

// Localization
export interface Localization {
  challengeTypes: Record<ChallengeType, string>;
  pollQuestion: (type: ChallengeType) => string;
  challengeAnnouncement: (type: ChallengeType, topic: string, endTime: string) => string;
  winnerAnnouncement: (username: string, score: number, type: ChallengeType) => string;
  noSubmissions: string;
  statsMessage: (wins: number, rank: number) => string;
  leaderboardTitle: (type: ChallengeType) => string;
  helpMessage: string;
}
