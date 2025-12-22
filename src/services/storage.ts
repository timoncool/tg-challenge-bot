// ============================================
// Cloudflare KV Storage Service
// ============================================

import type {
  Challenge,
  ChallengeType,
  Poll,
  Submission,
  LeaderboardEntry,
} from "../types";

export class StorageService {
  constructor(private kv: KVNamespace) {}

  // ============================================
  // Challenge Management
  // ============================================

  async getChallenge(type: ChallengeType): Promise<Challenge | null> {
    const data = await this.kv.get(`challenge:${type}`, "json");
    return data as Challenge | null;
  }

  async saveChallenge(challenge: Challenge): Promise<void> {
    await this.kv.put(`challenge:${challenge.type}`, JSON.stringify(challenge));
  }

  async getNextChallengeId(type: ChallengeType): Promise<number> {
    const key = `challenge:${type}:counter`;
    const current = await this.kv.get(key);
    const next = (parseInt(current || "0", 10) || 0) + 1;
    await this.kv.put(key, String(next));
    return next;
  }

  // ============================================
  // Poll Management
  // ============================================

  async getPoll(type: ChallengeType): Promise<Poll | null> {
    const data = await this.kv.get(`poll:${type}`, "json");
    return data as Poll | null;
  }

  async savePoll(poll: Poll): Promise<void> {
    await this.kv.put(`poll:${poll.type}`, JSON.stringify(poll));
  }

  async deletePoll(type: ChallengeType): Promise<void> {
    await this.kv.delete(`poll:${type}`);
  }

  // ============================================
  // Submissions Management
  // ============================================

  async getSubmissions(
    type: ChallengeType,
    challengeId: number
  ): Promise<Submission[]> {
    const data = await this.kv.get(
      `submissions:${type}:${challengeId}`,
      "json"
    );
    return (data as Submission[]) || [];
  }

  async addSubmission(
    type: ChallengeType,
    challengeId: number,
    submission: Submission
  ): Promise<void> {
    const submissions = await this.getSubmissions(type, challengeId);

    // Avoid duplicates
    if (submissions.some((s) => s.messageId === submission.messageId)) {
      return;
    }

    submissions.push(submission);
    await this.kv.put(
      `submissions:${type}:${challengeId}`,
      JSON.stringify(submissions)
    );
  }

  async updateSubmissionScore(
    type: ChallengeType,
    challengeId: number,
    messageId: number,
    score: number
  ): Promise<void> {
    const submissions = await this.getSubmissions(type, challengeId);
    const submission = submissions.find((s) => s.messageId === messageId);

    if (submission) {
      submission.score = score;
      await this.kv.put(
        `submissions:${type}:${challengeId}`,
        JSON.stringify(submissions)
      );
    }
  }

  async clearSubmissions(
    type: ChallengeType,
    challengeId: number
  ): Promise<void> {
    await this.kv.delete(`submissions:${type}:${challengeId}`);
  }

  // ============================================
  // Leaderboard Management
  // ============================================

  async getLeaderboard(type: ChallengeType): Promise<LeaderboardEntry[]> {
    const data = await this.kv.get(`leaderboard:${type}`, "json");
    const map = (data as Record<string, LeaderboardEntry>) || {};
    return Object.values(map).sort((a, b) => b.wins - a.wins);
  }

  async addWin(
    type: ChallengeType,
    userId: number,
    username?: string
  ): Promise<void> {
    const data = await this.kv.get(`leaderboard:${type}`, "json");
    const map = (data as Record<string, LeaderboardEntry>) || {};

    const key = String(userId);
    if (!map[key]) {
      map[key] = { userId, username, wins: 0 };
    }

    map[key].wins += 1;
    map[key].lastWin = Date.now();
    if (username) {
      map[key].username = username;
    }

    await this.kv.put(`leaderboard:${type}`, JSON.stringify(map));
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
    const data = await this.kv.get("active_topics", "json");
    return (data as Record<number, ChallengeType>) || {};
  }

  async setActiveTopics(
    topics: Record<number, ChallengeType>
  ): Promise<void> {
    await this.kv.put("active_topics", JSON.stringify(topics));
  }

  async isActiveTopic(threadId: number): Promise<ChallengeType | null> {
    const topics = await this.getActiveTopics();
    return topics[threadId] || null;
  }
}
