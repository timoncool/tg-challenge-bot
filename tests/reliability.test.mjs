// What happens when a step fails or an admin steps in: results are not lost, the owner learns
// why, manual actions and extensions are respected, and the webhook keeps its registration.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, stubAi, stubAiFailing, seedCommunity, seedPoll,
  seedActiveChallenge, makeEnv, tickAt, sendUpdate, groupMessage, derivedWebhookSecret, CHAT, POLL_OPTIONS,
} from "./harness.mjs";

const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);
const key = (...parts) => `community:${CHAT}:${parts.join(":")}`;
const sent = (calls, method) => calls.filter((c) => c.method === method);
const OWNER = 777;
const YESTERDAY_14 = Date.UTC(2026, 7, 24, 14, 0);

function seedWinner(kv) {
  kv.seed(key("submissions", "daily", 20260823111), [
    { messageId: 1, userId: 11, username: "a_user", tgUsername: "a_user", score: 0, timestamp: 1 },
  ]);
  kv.seed(key("reactions", "daily", 20260823111, 1), { 101: 1 });
}

// ── A result is never lost to a Telegram error ─────────────────────────────

test("a winner message Telegram refuses still records the win and starts the next challenge", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:owner_chat_id", OWNER);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedWinner(kv);
  seedPoll(kv, { createdAt: Date.now() - 3600_000 });
  const calls = stubTelegram({
    options: POLL_OPTIONS,
    voterCounts: [1, 0, 0, 0, 0, 0],
    rejectSend: (body) => /ПОБЕДИТЕЛЬ/.test(body.text),
  });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  assert.equal(kv.json(key("leaderboard", "daily"))["11"].wins, 1, "the win is recorded");
  const ch = kv.json(key("challenge", "daily"));
  assert.equal(ch.status, "active");
  assert.equal(ch.topic, POLL_OPTIONS[0], "the next challenge started");
  const dm = sent(calls, "sendMessage").find((c) => c.body.chat_id === OWNER);
  assert.ok(dm, "the owner hears about the refused message");
  assert.match(dm.body.text, /объявление победителя/);
  assert.match(dm.body.text, /can't parse entities/);
});

test("a result that cannot be recorded keeps the old challenge instead of overwriting it", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14, topic: "Старая тема" });
  seedWinner(kv);
  seedPoll(kv, { createdAt: Date.now() - 3600_000 });
  kv.failPutFor = key("challenge", "daily");
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const ch = kv.json(key("challenge", "daily"));
  assert.equal(ch.topic, "Старая тема");
  assert.equal(ch.status, "active", "the old challenge stays open for the retry");
  assert.equal(sent(calls, "stopPoll").length, 0, "the poll is not consumed while the old result is pending");
  assert.ok(kv.json(key("cron_state"))["challenge:daily!"], "the slot retries");
});

test("votes are not replaced by a guess when Telegram is briefly down", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  seedPoll(kv, { createdAt: Date.now() - 3600_000 });
  stubTelegram({ options: POLL_OPTIONS, telegramDown: true });

  await tickAt(worker, env, { hour: 14 });
  assert.ok(kv.has(key("poll", "daily")), "the poll is kept for the retry");
  assert.ok(kv.json(key("cron_state"))["challenge:daily!"], "the slot retries");

  stubTelegram({ options: POLL_OPTIONS, voterCounts: [0, 0, 5, 0, 0, 0] });
  await tickAt(worker, env, { hour: 14, minute: 15 });
  assert.equal(kv.json(key("challenge", "daily")).topic, POLL_OPTIONS[2], "the voted theme wins");
});

// ── The owner learns why ───────────────────────────────────────────────────

test("the failure DM names the cause", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:owner_chat_id", OWNER);
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing(402, "This request requires more credits");

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const dm = sent(calls, "sendMessage").find((c) => c.body.chat_id === OWNER);
  assert.match(dm.body.text, /Причина: .*402/);
  assert.match(dm.body.text, /more credits/);
  assert.equal(kv.json("alerts:log")[0].context.error.includes("402"), true);
});

test("a community name with & does not break the owner DM", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("communities:list", { [String(CHAT)]: { chatId: CHAT, name: "Art & <Code>", addedAt: 1 } });
  kv.seed("settings:owner_chat_id", OWNER);
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const dm = sent(calls, "sendMessage").find((c) => c.body.chat_id === OWNER);
  assert.match(dm.body.text, /«Art &amp; &lt;Code&gt;»/);
});

// ── Admin actions are respected ────────────────────────────────────────────

test("an extended challenge is not cut short by its start slot", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14, topic: "Продлённая тема" });
  const extendedTo = Date.UTC(2026, 7, 25, 19, 0);
  const ch = kv.json(key("challenge", "daily"));
  kv.seed(key("challenge", "daily"), { ...ch, endsAt: extendedTo });
  seedPoll(kv, { createdAt: Date.now() - 3600_000 });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 0, 0, 0, 0] });

  await tickAt(worker, env, { hour: 14 });
  assert.equal(kv.json(key("challenge", "daily")).topic, "Продлённая тема", "14:00 does not replace it");

  await tickAt(worker, env, { hour: 18, minute: 59 });
  assert.equal(kv.json(key("challenge", "daily")).topic, "Продлённая тема", "still running before its end");

  await tickAt(worker, env, { hour: 19 });
  assert.equal(kv.json(key("challenge", "daily")).topic, POLL_OPTIONS[0], "the next one starts at the announced end");
});

test("a /run while the slot keeps failing is not replaced by the slot's retry", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: YESTERDAY_14 });
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();
  await tickAt(worker, env, { hour: 14 });
  assert.ok(kv.json(key("cron_state"))["challenge:daily!"], "precondition: the slot failed");

  // The admin starts one by hand at 14:05 (simulated in KV: startedAt after the slot).
  kv.seed(key("challenge", "daily"), {
    id: 20260825001, type: "daily", topic: "Ручная тема", topicFull: "Ручная тема", status: "active",
    startedAt: Date.UTC(2026, 7, 25, 14, 5), endsAt: Date.UTC(2026, 7, 26, 14, 0), topicThreadId: 4,
  });
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Повтор"));
  await tickAt(worker, env, { hour: 14, minute: 20 });

  assert.equal(kv.json(key("challenge", "daily")).topic, "Ручная тема");
  assert.equal(sent(calls, "sendMessage").length, 0, "no second announcement");
  assert.equal(kv.json(key("cron_state"))["challenge:daily"], Date.UTC(2026, 7, 25, 14, 0));
});

test("the dashboard's Cancel closes the open poll", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() - 3600_000 });
  const calls = stubTelegram({ options: POLL_OPTIONS });

  const res = await worker.fetch(new Request(`https://bot.test/admin/cancel-poll/daily?chat_id=${CHAT}`, {
    method: "POST", headers: { Authorization: "Bearer secret" },
  }), makeEnv(kv));

  assert.equal(res.status, 200);
  assert.ok(sent(calls, "stopPoll").some((c) => c.body.message_id === 138336));
  assert.equal(kv.has(key("poll", "daily")), false);
});

test("a failed admin action returns the reason", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing(402, "This request requires more credits");

  const res = await worker.fetch(new Request(`https://bot.test/admin/poll/daily?chat_id=${CHAT}`, {
    method: "POST", headers: { Authorization: "Bearer secret" },
  }), makeEnv(kv));

  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /402/);
});

// ── Webhook ───────────────────────────────────────────────────────────────

test("an outdated webhook registration is brought up to date", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({
    webhookInfo: { url: "https://bot.test/webhook", allowed_updates: ["message", "message_reaction"], max_connections: 40 },
  });

  const res = await worker.fetch(new Request("https://bot.test/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "hook" },
    body: JSON.stringify(groupMessage({ text: "привет" })),
  }), { ...makeEnv(kv), WEBHOOK_SECRET: "hook" });
  assert.equal(res.status, 200);

  const set = sent(calls, "setWebhook");
  assert.equal(set.length, 1);
  assert.equal(set[0].body.url, "https://bot.test/webhook");
  assert.equal(set[0].body.max_connections, 1);
  assert.ok(set[0].body.allowed_updates.includes("poll"));
  assert.equal(set[0].body.secret_token, "hook");
});

test("an update without the secret is refused and the webhook is re-registered with one", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({
    webhookInfo: { url: "https://bot.test/webhook", allowed_updates: ["message", "message_reaction", "poll"], max_connections: 1 },
    adminIds: [42],
  });
  const env = makeEnv(kv);

  const res = await worker.fetch(new Request("https://bot.test/webhook", {
    method: "POST",
    body: JSON.stringify(groupMessage({ text: "/finish_daily", thread: 4 })),
  }), env);

  assert.equal(res.status, 403, "a forged update is not processed");
  const set = sent(calls, "setWebhook");
  assert.equal(set.length, 1);
  assert.equal(set[0].body.secret_token, derivedWebhookSecret(env), "the secret is derived from BOT_TOKEN");
  assert.equal(sent(calls, "getChatMember").length, 0, "no command was looked at");
});

test("an up-to-date webhook registration is left alone", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({
    webhookInfo: { url: "https://bot.test/webhook", allowed_updates: ["message", "message_reaction", "poll"], max_connections: 1 },
  });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "привет" }));
  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "ещё" }));

  assert.equal(sent(calls, "setWebhook").length, 0);
  assert.equal(sent(calls, "getWebhookInfo").length, 1, "checked once per isolate");
});

test("an update is processed even when its dedup marker cannot be stored", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const update = groupMessage({ text: "/suggest Тема при сбое KV", thread: 4 });
  kv.failPutFor = `webhook:processed:${update.update_id}`;
  stubTelegram();

  await sendUpdate(worker, makeEnv(kv), update);

  assert.equal(kv.json(key("suggestions", "daily"))[0].theme, "Тема при сбое KV");
});

test("the closing update of a replaced poll does not overwrite the live counts", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.now() });
  kv.seed("poll_index:old-poll", { chatId: CHAT, type: "daily" });
  kv.seed(key("poll_votes", "daily"), { total: 3, options: [], updatedAt: 1 });
  stubTelegram();

  await sendUpdate(worker, makeEnv(kv), {
    update_id: 9001,
    poll: { id: "old-poll", total_voter_count: 0, is_closed: true, options: [{ text: "x", voter_count: 0 }] },
  });

  assert.equal(kv.json(key("poll_votes", "daily")).total, 3);
});

// ── Submissions ───────────────────────────────────────────────────────────

test("with links accepted, a link with the default preview counts as a work", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed(key("settings", "accept_links"), true);
  kv.seed(key("active_topics"), { 4: "daily" });
  seedActiveChallenge(kv, { startedAt: Date.now() - 3600_000 });
  const ch = kv.json(key("challenge", "daily"));
  kv.seed(key("challenge", "daily"), { ...ch, endsAt: Date.now() + 3600_000 });
  stubTelegram();

  const link = "https://example.com/art";
  const withPreview = groupMessage({ text: link, thread: 4, extra: { entities: [{ type: "url", offset: 0, length: link.length }] } });
  const noPreview = groupMessage({
    text: link, thread: 4, from: { id: 43, username: "other_user" },
    extra: { entities: [{ type: "url", offset: 0, length: link.length }], link_preview_options: { is_disabled: true } },
  });
  await sendUpdate(worker, makeEnv(kv), withPreview);
  await sendUpdate(worker, makeEnv(kv), noPreview);

  const works = kv.json(key("submissions", "daily", ch.id));
  assert.equal(works.length, 1);
  assert.equal(works[0].messageId, withPreview.message.message_id);
});

// ── Commands ──────────────────────────────────────────────────────────────

test("a command addressed to another bot is ignored", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({ botUsername: "challenge_test_bot" });

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/stats@other_bot" }));
  assert.equal(sent(calls, "sendMessage").length, 0);

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/stats@Challenge_Test_Bot" }));
  assert.equal(sent(calls, "sendMessage").length, 1, "our own @name still works");
});

test("/suggest with the theme on the next line is accepted", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram();

  await sendUpdate(worker, makeEnv(kv), groupMessage({ text: "/suggest\nНочной маяк", thread: 4 }));

  assert.equal(kv.json(key("suggestions", "daily"))[0].theme, "Ночной маяк");
});
