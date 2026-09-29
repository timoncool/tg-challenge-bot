// Challenge length, poll hygiene, prompts, HTML safety, results and permissions.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, stubAi, stubAiFailing, captureAi, seedCommunity, seedPoll,
  seedActiveChallenge, makeEnv, tickAt, sendUpdate, groupMessage, CHAT, POLL_OPTIONS,
} from "./harness.mjs";

const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const key = (...parts) => `community:${CHAT}:${parts.join(":")}`;
const sent = (calls, method) => calls.filter((c) => c.method === method);

// ── Challenge length follows the schedule ──────────────────────────────────

test("a monthly challenge runs until the next monthly start, not a fixed 28 days", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { type: "monthly", createdAt: Date.now() - 7 * DAY });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [0, 3, 0, 0, 0, 0] });
  stubAi(sixThemes("Дневная")); // the daily slot fires at the same 14:00

  await tickAt(worker, makeEnv(kv), { month: 8, day: 23, hour: 14 }); // monthly slot: 23rd 14:00

  // startedAt comes from the real clock, so expect the first "23rd 14:00 UTC" after it.
  const ch = kv.json(key("challenge", "monthly"));
  const start = new Date(ch.startedAt);
  let expected = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 23, 14);
  if (expected <= ch.startedAt) expected = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 23, 14);
  assert.equal(ch.endsAt, expected, "ends at the next monthly start");
  assert.notEqual(ch.endsAt - ch.startedAt, 28 * DAY);
});

test("weekly and daily challenges end exactly at their next start", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { type: "weekly", createdAt: Date.now() - DAY });
  seedPoll(kv, { type: "daily", createdAt: Date.now() - HOUR });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { month: 7, day: 28, hour: 14 }); // Friday: daily + weekly start

  const weekly = kv.json(key("challenge", "weekly"));
  assert.equal(new Date(weekly.endsAt).getUTCDay(), 5);
  assert.equal(new Date(weekly.endsAt).getUTCHours(), 14);
  assert.ok(weekly.endsAt - weekly.startedAt <= 7 * DAY);

  const daily = kv.json(key("challenge", "daily"));
  assert.equal(new Date(daily.endsAt).getUTCHours(), 14);
  assert.ok(daily.endsAt - daily.startedAt <= DAY);
});

// ── Abandoned polls are closed in Telegram, not just forgotten ─────────────

test("a stale poll is stopped and unpinned in the chat when replaced", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() - 3 * DAY });
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Свежая"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.ok(sent(calls, "stopPoll").some((c) => c.body.message_id === 138336), "old poll must be stopped");
  assert.ok(sent(calls, "unpinChatMessage").some((c) => c.body.message_id === 138336), "old poll must be unpinned");
  assert.equal(kv.json(key("poll", "daily")).options[0], "Свежая 1");
});

test("/poll_daily closes the previous poll before posting a new one", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  const calls = stubTelegram({ options: POLL_OPTIONS, adminIds: [42] });
  stubAi(sixThemes("Ручная"));

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/poll_daily", thread: 4 }));

  assert.ok(sent(calls, "stopPoll").some((c) => c.body.message_id === 138336));
  assert.equal(sent(calls, "sendPoll").length, 1);
  assert.equal(kv.json(key("poll", "daily")).options[0], "Ручная 1");
});

// ── Prompts: admin overrides reach the model, NSFW wording ─────────────────

test("prompt overrides from the admin panel reach the AI request", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:ai:prompts", {
    template: "TYPE={TYPE} MODE={MODE} INSTR={INSTRUCTION} SAMPLE=[{SAMPLE}]{HISTORY}",
    modes: {
      vanilla: { instruction: "СВОЯ ИНСТРУКЦИЯ $& $1", corpus: ["единственный пример"] },
      medium: { instruction: "m", corpus: ["m"] },
      nsfw: { instruction: "n", corpus: ["n"] },
    },
  });
  stubTelegram({ options: POLL_OPTIONS });
  const requests = captureAi(sixThemes("Тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /^TYPE=ДНЕВНОГО MODE=VANILLA INSTR=СВОЯ ИНСТРУКЦИЯ \$& \$1 SAMPLE=\[единственный пример\]/);
});

test("the built-in NSFW prompt asks for artistic, not hardcore, erotica", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed(key("settings", "content_mode"), "nsfw");
  stubTelegram({ options: POLL_OPTIONS });
  const requests = captureAi(sixThemes("Тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /Художественная эротика/);
  assert.doesNotMatch(prompt, /Жесткая эротика/);
});

test("an OpenRouter answer with no content is reported with its finish reason", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  captureAi([], { content: "", finishReason: "content_filter" });

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const entry = kv.json("ai:history:global")[0];
  assert.equal(entry.success, false);
  assert.match(entry.error, /пустой ответ \(finish_reason: content_filter\)/);
  assert.doesNotMatch(entry.error, /Cannot read properties/);
});

test("the model that actually answered is recorded", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  captureAi(sixThemes("Тема"), { model: "google/gemini-3.5-flash-20260901" });

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.equal(kv.json("ai:history:global")[0].resolvedModel, "google/gemini-3.5-flash-20260901");
});

// ── HTML safety and user input ────────────────────────────────────────────

test("a theme with & and < is escaped in the announcement instead of breaking it", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const risky = "Кошки & собаки <3";
  const options = [risky, ...POLL_OPTIONS.slice(1)];
  seedPoll(kv, { createdAt: Date.now() - HOUR, options });
  const calls = stubTelegram({ options, voterCounts: [5, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const announcement = sent(calls, "sendMessage").find((c) => /ЧЕЛЛЕНДЖ ДНЯ/.test(c.body.text));
  assert.ok(announcement, "challenge must be announced");
  assert.match(announcement.body.text, /Кошки &amp; собаки &lt;3/);
  assert.equal(kv.json(key("challenge", "daily")).topic, risky);
});

test("/suggest keeps a Latin first word", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/suggest Cyberpunk city at night", thread: 4 }));

  assert.equal(kv.json(key("suggestions", "daily"))[0].theme, "Cyberpunk city at night");
});

test("/help shows challenge times with minutes and an explicit UTC", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv, {
    schedule: {
      daily: { pollHour: 5, challengeHour: 14, pollMinute: 0, challengeMinute: 30 },
      weekly: { pollDay: 3, pollHour: 5, challengeDay: 5, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
      monthly: { pollDay: 16, pollHour: 9, challengeDay: 23, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
    },
  });
  const calls = stubTelegram({ options: POLL_OPTIONS });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/help" }));

  assert.match(sent(calls, "sendMessage")[0].body.text, /каждый день в 14:30 UTC/);
});

// ── Results ───────────────────────────────────────────────────────────────

// The day before the simulated 2026-08-25 14:00 tick: the challenge that slot closes.
const YESTERDAY_14 = Date.UTC(2026, 7, 24, 14, 0);

function seedSubmissions(kv, list, challengeId = 20260823111) {
  kv.seed(key("submissions", "daily", challengeId), list);
}

test("nobody gets a win when no work received a single vote", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedSubmissions(kv, [
    { messageId: 1, userId: 11, username: "a_user", score: 0, timestamp: 1 },
    { messageId: 2, userId: 12, username: "b_user", score: 0, timestamp: 2 },
  ]);
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  assert.ok(sent(calls, "sendMessage").some((c) => /голосов нет/.test(c.body.text)));
  assert.equal(sent(calls, "forwardMessage").length, 0, "nothing goes to the winners topic");
  assert.equal(kv.json(key("leaderboard", "daily")), null, "no wins recorded");
});

test("scores are recounted from reactions when the challenge closes", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedSubmissions(kv, [
    { messageId: 1, userId: 11, username: "a_user", score: 0, timestamp: 1 },
    { messageId: 2, userId: 12, username: "b_user", score: 5, timestamp: 2 },
  ]);
  kv.seed(key("reactions", "daily", 20260823111, 1), { 101: 1, 102: 1 });
  kv.seed(key("reactions", "daily", 20260823111, 2), { 103: 1 });
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const board = kv.json(key("leaderboard", "daily"));
  assert.equal(board["11"].wins, 1, "the work with two real votes wins");
  assert.equal(board["12"], undefined);
});

test("the winner announcement survives a deleted winning work", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedSubmissions(kv, [{ messageId: 7, userId: 11, username: "a_user", score: 0, timestamp: 1 }]);
  kv.seed(key("reactions", "daily", 20260823111, 7), { 101: 1 });
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const winnerMsg = sent(calls, "sendMessage").find((c) => /ПОБЕДИТЕЛЬ/.test(c.body.text));
  assert.deepEqual(winnerMsg.body.reply_parameters, { message_id: 7, allow_sending_without_reply: true });
  assert.equal(winnerMsg.body.reply_to_message_id, undefined);
});

test("a first name is shown as a name, a username as a mention", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedSubmissions(kv, [
    { messageId: 1, userId: 11, username: "Максим", score: 1, timestamp: 1 },
    { messageId: 2, userId: 12, username: "real_nick", tgUsername: "real_nick", score: 1, timestamp: 2 },
  ]);
  kv.seed(key("reactions", "daily", 20260823111, 1), { 101: 1 });
  kv.seed(key("reactions", "daily", 20260823111, 2), { 102: 1 });
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const text = sent(calls, "sendMessage").find((c) => /ПОБЕДИТЕЛЬ/.test(c.body.text)).body.text;
  assert.match(text, /Максим/);
  assert.doesNotMatch(text, /@Максим/);
  assert.match(text, /@real_nick/);
});

test("a poll nobody voted in still supplies the theme, without an AI call", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [0, 0, 0, 0, 0, 0] });
  const requests = captureAi(sixThemes("AI"));

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  assert.ok(POLL_OPTIONS.includes(kv.json(key("challenge", "daily")).topic));
  assert.equal(requests.length, 0);
});

// ── Publishing is undone when it could not be recorded ─────────────────────

test("a poll that could not be saved is deleted, so the retry does not double it", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.failPutFor = key("poll", "daily");
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const posted = sent(calls, "sendPoll").length;
  assert.equal(posted, 1);
  assert.equal(sent(calls, "deleteMessage").length, 1, "the unrecorded poll must be taken back");
  assert.ok(kv.json(key("cron_state"))["poll:daily!"], "the slot is marked for retry");
});

test("an announcement that could not be saved is deleted", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() - HOUR });
  kv.failPutFor = key("challenge", "daily");
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const announcement = sent(calls, "sendMessage").find((c) => /ЧЕЛЛЕНДЖ ДНЯ/.test(c.body.text));
  assert.ok(announcement);
  assert.equal(sent(calls, "deleteMessage").length, 1);
});

// ── Owner reporting ───────────────────────────────────────────────────────

test("the owner hears when a failed slot recovers", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  kv.seed("settings:owner_chat_id", 777);

  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();
  await tickAt(worker, env, { hour: 5 });

  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));
  await tickAt(worker, env, { hour: 5, minute: 15 });

  const dm = sent(calls, "sendMessage").find((c) => c.body.chat_id === 777);
  assert.ok(dm, "a recovery DM is expected");
  assert.match(dm.body.text, /Восстановилось/);
});

// ── Community management belongs to the bot owner ──────────────────────────

test("a chat admin who is not the owner cannot register a community", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  kv.seed("settings:owner_chat_id", 999);
  stubTelegram({ adminIds: [42] });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/register_community", from: { id: 42, username: "stranger" } }));

  assert.equal(kv.json("communities:list"), null);
});

test("the owner can register a community", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  kv.seed("settings:owner_chat_id", 999);
  stubTelegram({ adminIds: [] });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/register_community Моя группа", from: { id: 999, username: "owner" } }));

  assert.equal(kv.json("communities:list")[String(CHAT)].name, "Моя группа");
});

test("a chat admin who is not the owner does not see the community list", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:owner_chat_id", 999);
  const calls = stubTelegram({ adminIds: [42] });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/list_communities", from: { id: 42, username: "stranger" } }));

  assert.equal(sent(calls, "sendMessage").filter((c) => /СООБЩЕСТВА/.test(c.body.text)).length, 0);
});

test("ordinary messages do not trigger an admin rights lookup", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({ adminIds: [] });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "просто сообщение в чате" }));

  assert.equal(sent(calls, "getChatMember").length, 0);
});
