// Shared types reflecting KV schema from worker-mr-challenger.js
// Keep in sync with bot's storage layer. See spec §4.

export type ChallengeType = "daily" | "weekly" | "monthly";
export type ContentMode = "vanilla" | "medium" | "nsfw";

export interface Community {
  chatId: number;
  name: string;
  addedAt: number;
}

export interface Topics {
  daily: number;
  weekly: number;
  monthly: number;
  winners: number;
}

export interface ScheduleEntry {
  pollHour?: number;
  pollDay?: number;
  challengeHour: number;
  challengeDay?: number;
}

export interface Schedule {
  daily: ScheduleEntry;
  weekly: ScheduleEntry;
  monthly: ScheduleEntry;
}

export interface SubmissionLimits {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface Challenge {
  id: number;
  type: ChallengeType;
  topic: string;
  topicFull: string;
  status: "active" | "finished";
  startedAt: number;
  endsAt: number;
  topicThreadId: number;
  announcementMessageId: number;
}

export interface Poll {
  type: ChallengeType;
  pollId: string;
  messageId: number;
  options: string[];
  createdAt: number;
  topicThreadId: number;
  suggestionIds?: string[];
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
  participations: number;
  lastWin?: number;
  lastParticipation?: number;
}

export interface Suggestion {
  id: string;
  messageId: number;
  userId: number;
  username?: string;
  theme: string;
  createdAt: number;
  threadId: number;
  reactions: Record<string, 1>;
  reactionCount: number;
}

// AI Engine — new (§7)
export type AiProvider = "gemini" | "openrouter";

export interface AiConfig {
  id: string;
  name: string;
  provider: AiProvider;
  apiUrl: string;
  apiKey: string; // returned masked from server: "•••" or "...last4"
  model: string;
  temperature?: number;
  referer?: string;
  title?: string;
  fallbacks?: string[];
  supportsJsonMode?: boolean;
  createdAt: number;
  updatedAt: number;
}

// Dashboard payload — composed by GET /api/dashboard
export interface CommunityDashboard {
  community: Community;
  topics: Topics;
  contentMode: ContentMode;
  acceptLinks: boolean;
  submissionLimits: SubmissionLimits;
  schedule: Schedule;
  health: "healthy" | "warning" | "broken";
  warnings: string[];
  aiConfigName: string;
  pendingSuggestions: { ready: number; waiting: number };
  perType: Record<
    ChallengeType,
    {
      state: "active" | "poll-open" | "idle" | "stale";
      challenge: Challenge | null;
      poll: Poll | null;
      pollVotes?: { total: number; options: { text: string; votes: number }[] };
      participants?: number;
      submissionsCount?: number;
      lead?: { username?: string; userId: number; score: number };
      nextPollAt?: number;
      nextChallengeAt?: number;
    }
  >;
}

export interface DashboardResponse {
  serverTime: number;
  communities: CommunityDashboard[];
}
