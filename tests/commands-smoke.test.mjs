// Every chat command runs end to end without throwing: a typo in a rarely used branch
// would otherwise surface only as a silent "handleMessage error" in production logs.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, seedCommunity, seedPoll, seedActiveChallenge,
  makeEnv, sendUpdate, groupMessage, CHAT,
} from "./harness.mjs";

const key = (...parts) => `community:${CHAT}:${parts.join(":")}`;
const ADMIN = { id: 42, username: "admin_user", first_name: "Admin" };

const COMMANDS = [
  "/help", "/start", "/admin", "/status", "/topic_id",
  "/cs_daily", "/cs_weekly", "/cs_monthly",
  "/stats", "/leaderboard", "/leaderboard weekly", "/current",
  "/set_content_mode", "/set_content_mode medium",
  "/set_accept_links", "/set_accept_links on",
  "/set_suggestion_reactions", "/set_suggestion_reactions 5",
  "/set_limit_daily", "/set_limit_daily 2",
  "/schedule_daily 15", "/schedule_weekly 1 15", "/schedule_monthly 5 15", "/schedule_daily",
  "/suggest", "/suggest Туманный порт на рассвете", "/suggestions", "/suggestions_daily",
  "/clear_suggestions_weekly", "/list_communities", "/set_daily",
];

for (const text of COMMANDS) {
  test(`${text} answers without an error`, async () => {
    const worker = await loadWorker();
    const kv = new FakeKV();
    seedCommunity(kv);
    kv.seed("settings:owner_chat_id", ADMIN.id);
    const now = Date.now();
    seedActiveChallenge(kv, { startedAt: now - 3600_000 });
    kv.seed(key("submissions", "daily", 20260823111), [
      { messageId: 1, userId: 11, username: "Максим", tgUsername: null, score: 2, timestamp: 1 },
      { messageId: 2, userId: 12, username: "real_nick", tgUsername: "real_nick", score: 1, timestamp: 2 },
    ]);
    kv.seed(key("leaderboard", "daily"), { 11: { userId: 11, username: "Максим", wins: 2, participations: 3 } });
    kv.seed(key("suggestions", "daily"), [
      { id: "s1", messageId: 77, userId: 11, username: "Максим", theme: "Старый маяк", reactionCount: 4, createdAt: 1 },
    ]);
    seedPoll(kv, { createdAt: now - 3600_000 });
    const calls = stubTelegram({ adminIds: [ADMIN.id] });

    const errors = [];
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(" ")); };
    try {
      await sendUpdate(worker, makeEnv(kv), groupMessage({ text, from: ADMIN, thread: 4 }));
    } finally {
      console.error = originalError;
    }

    assert.deepEqual(errors.filter((e) => /handleMessage error|Webhook error|is not defined|is not a function/.test(e)), []);
    assert.ok(calls.some((c) => c.method === "sendMessage"), `${text} sent no reply`);
  });
}
