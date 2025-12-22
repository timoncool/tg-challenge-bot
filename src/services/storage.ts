// ============================================
// Cloudflare KV Storage Service
// With error handling and race condition protection
// ============================================

import type {
  Challenge,
  ChallengeType,
  Poll,
  Submission,
  LeaderboardEntry,
} from "../types";

// Maximum retry attempts for operations with race conditions
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 50;

// Helper: delay for retry
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StorageService {
  constructor(private kv: KVNamespace) {}

  // ============================================
  // Safe KV Operations (with error handling)
  // ============================================

  private async safeGet<T>(key: string): Promise<T | null> {
    try {
      const data = await this.kv.get(key, "json");
      return data as T | null;
    } catch (error) {
      console.error(`KV get error for ${key}:`, error);
      return null;
    }
  }

  private async safePut(key: string, value: string): Promise<boolean> {
    try {
      await this.kv.put(key, value);
      return true;
    } catch (error) {
      console.error(`KV put error for ${key}:`, error);
      return false;
    }
  }

  private async safeDelete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error(`KV delete error for ${key}:`, error);
      return false;
    }
  }

  // ============================================
  // Challenge Management
  // ============================================

  async getChallenge(type: ChallengeType): Promise<Challenge | null> {
    return this.safeGet<Challenge>(`challenge:${type}`);
  }

  async saveChallenge(challenge: Challenge): Promise<boolean> {
    return this.safePut(
      `challenge:${challenge.type}`,
      JSON.stringify(challenge)
    );
  }

  async getNextChallengeId(type: ChallengeType): Promise<number> {
    // Use timestamp-based ID to avoid race conditions
    // Format: YYYYMMDD + sequence (e.g., 20241222001)
    const now = new Date();
    const datePrefix =
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate();

    const key = `challenge:${type}:counter`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const current = await this.kv.get(key);
        const currentNum = parseInt(current || "0", 10) || 0;

        // If same day, increment; otherwise reset to datePrefix * 1000 + 1
        const currentDate = Math.floor(currentNum / 1000);
        const next =
          currentDate === datePrefix
            ? currentNum + 1
            : datePrefix * 1000 + 1;

        await this.kv.put(key, String(next));
        return next;
      } catch (error) {
        console.error(`getNextChallengeId attempt ${attempt + 1} failed:`, error);
        if (attempt < MAX_RETRIES - 1) {
          await delay(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    // Fallback: use timestamp as ID
    return Date.now();
  }

  // ============================================
  // Poll Management
  // ============================================

  async getPoll(type: ChallengeType): Promise<Poll | null> {
    return this.safeGet<Poll>(`poll:${type}`);
  }

  async savePoll(poll: Poll): Promise<boolean> {
    return this.safePut(`poll:${poll.type}`, JSON.stringify(poll));
  }

  async deletePoll(type: ChallengeType): Promise<boolean> {
    return this.safeDelete(`poll:${type}`);
  }

  // ============================================
  // Submissions Management (with retry for race conditions)
  // ============================================

  async getSubmissions(
    type: ChallengeType,
    challengeId: number
  ): Promise<Submission[]> {
    const data = await this.safeGet<Submission[]>(
      `submissions:${type}:${challengeId}`
    );
    return data || [];
  }

  async addSubmission(
    type: ChallengeType,
    challengeId: number,
    submission: Submission
  ): Promise<boolean> {
    const key = `submissions:${type}:${challengeId}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const submissions = await this.getSubmissions(type, challengeId);

        // Avoid duplicates by messageId
        if (submissions.some((s) => s.messageId === submission.messageId)) {
          return true; // Already exists, consider it success
        }

        submissions.push(submission);
        const success = await this.safePut(key, JSON.stringify(submissions));

        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`addSubmission attempt ${attempt + 1} failed:`, error);
      }

      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    console.error(`addSubmission failed after ${MAX_RETRIES} attempts`);
    return false;
  }

  async updateSubmissionScore(
    type: ChallengeType,
    challengeId: number,
    messageId: number,
    score: number
  ): Promise<boolean> {
    const key = `submissions:${type}:${challengeId}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const submissions = await this.getSubmissions(type, challengeId);
        const submission = submissions.find((s) => s.messageId === messageId);

        if (!submission) {
          return false; // Submission not found
        }

        // Only update if score actually changed (optimization)
        if (submission.score === score) {
          return true;
        }

        submission.score = score;
        const success = await this.safePut(key, JSON.stringify(submissions));

        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`updateSubmissionScore attempt ${attempt + 1} failed:`, error);
      }

      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    console.error(`updateSubmissionScore failed after ${MAX_RETRIES} attempts`);
    return false;
  }

  async clearSubmissions(
    type: ChallengeType,
    challengeId: number
  ): Promise<boolean> {
    return this.safeDelete(`submissions:${type}:${challengeId}`);
  }

  // ============================================
  // Leaderboard Management (with retry for race conditions)
  // ============================================

  async getLeaderboard(type: ChallengeType): Promise<LeaderboardEntry[]> {
    const data = await this.safeGet<Record<string, LeaderboardEntry>>(
      `leaderboard:${type}`
    );
    const map = data || {};
    return Object.values(map).sort((a, b) => b.wins - a.wins);
  }

  async addWin(
    type: ChallengeType,
    userId: number,
    username?: string
  ): Promise<boolean> {
    const key = `leaderboard:${type}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const data = await this.safeGet<Record<string, LeaderboardEntry>>(key);
        const map = data || {};

        const userKey = String(userId);
        if (!map[userKey]) {
          map[userKey] = { userId, username, wins: 0 };
        }

        map[userKey].wins += 1;
        map[userKey].lastWin = Date.now();
        if (username) {
          map[userKey].username = username;
        }

        const success = await this.safePut(key, JSON.stringify(map));

        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`addWin attempt ${attempt + 1} failed:`, error);
      }

      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    console.error(`addWin failed after ${MAX_RETRIES} attempts`);
    return false;
  }

  async getUserStats(
    type: ChallengeType,
    userId: number
  ): Promise<{ wins: number; rank: number }> {
    const leaderboard = await this.getLeaderboard(type);
    const index = leaderboard.findIndex((e) => e.userId === userId);

    if (index === -1) {
      return { wins: 0, rank: leaderboard.length + 1 };
    }

    return { wins: leaderboard[index].wins, rank: index + 1 };
  }

  // ============================================
  // Active Topics Tracking
  // ============================================

  async getActiveTopics(): Promise<Record<number, ChallengeType>> {
    const data = await this.safeGet<Record<number, ChallengeType>>(
      "active_topics"
    );
    return data || {};
  }

  async setActiveTopics(
    topics: Record<number, ChallengeType>
  ): Promise<boolean> {
    return this.safePut("active_topics", JSON.stringify(topics));
  }

  async isActiveTopic(threadId: number): Promise<ChallengeType | null> {
    const topics = await this.getActiveTopics();
    return topics[threadId] || null;
  }

  // ============================================
  // Theme History (to avoid repetition)
  // ============================================

  private readonly MAX_THEME_HISTORY = 10;

  async getThemeHistory(type: ChallengeType): Promise<string[]> {
    const data = await this.safeGet<string[]>(`theme_history:${type}`);
    return data || [];
  }

  async addThemeToHistory(type: ChallengeType, theme: string): Promise<boolean> {
    const history = await this.getThemeHistory(type);

    // Add new theme at the beginning
    history.unshift(theme);

    // Keep only last N themes
    const trimmed = history.slice(0, this.MAX_THEME_HISTORY);

    return this.safePut(`theme_history:${type}`, JSON.stringify(trimmed));
  }
}
