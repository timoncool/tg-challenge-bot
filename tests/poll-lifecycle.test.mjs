// Regression tests for the poll → challenge lifecycle.
//
// Production incident (2026-08-22 .. 08-25): one KV delete of `poll:daily` did
// not stick. generatePoll skips whenever *any* poll exists, so poll generation
// deadlocked permanently, and startChallenge kept re-reading the same dead poll
// and falling back to options[0] — the group got the identical topic every day.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, stubAi, seedCommunity, seedPoll,
  seedActiveChallenge, makeEnv, tickAt, CHAT, POLL_OPTIONS,
} from "./harness.mjs";

/** The AI parser rejects anything shorter than six themes. */
const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);

const DAY = 86400_000;
const pollKey = `community:${CHAT}:poll:daily`;
const challengeKey = `community:${CHAT}:challenge:daily`;

test("happy path: poll winner becomes the challenge and the poll is removed", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 25, 5, 0) });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 24, 14, 0) });
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 4, 0, 0, 2] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  assert.equal(kv.json(challengeKey).topic, "Полузатопленный бальный зал");
  assert.equal(kv.has(pollKey), false, "poll must be deleted after it is consumed");
});

test("a poll left over from a previous cycle is replaced, not skipped", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  // Poll from three days ago that a lost delete left behind.
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 22, 5, 0) });
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Свежая тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const poll = kv.json(pollKey);
  assert.ok(poll, "a poll must exist after the poll hour");
  assert.ok(
    poll.createdAt >= Date.UTC(2026, 7, 25, 0, 0),
    `stale poll was kept instead of regenerated (createdAt=${new Date(poll.createdAt).toISOString()})`,
  );
  assert.equal(poll.options[0], "Свежая тема 1");
});

test("a poll created moments ago is not regenerated (double cron tick)", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const justNow = Date.UTC(2026, 7, 25, 5, 0, 3);
  seedPoll(kv, { createdAt: justNow });
  stubTelegram({ options: POLL_OPTIONS });

  await tickAt(worker, makeEnv(kv), { hour: 5, second: 40 });

  assert.equal(kv.json(pollKey).createdAt, justNow, "poll from the same tick must be left alone");
});

test("an already-closed poll is not reused as the topic source", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 22, 5, 0) });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 24, 14, 0) });
  stubTelegram({ pollClosed: true });
  stubAi(sixThemes("Тема от AI"));

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const challenge = kv.json(challengeKey);
  assert.notEqual(
    challenge.topic, POLL_OPTIONS[0],
    "must not fall back to options[0] of a poll Telegram already closed",
  );
  assert.equal(challenge.topic, "Тема от AI 1");
  assert.equal(kv.has(pollKey), false, "the dead poll must be cleared");
});

test("a KV delete that does not stick is reported, not swallowed", async () => {
  // Full replay of the production incident: the delete at challenge time is lost,
  // and the next poll hour has to notice the leftover and report it.
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 24, 5, 0) });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 23, 14, 0) });

  kv.swallowDeleteFor = pollKey;
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 4, 0, 0, 2] });
  await tickAt(worker, env, { day: 24, hour: 14 });
  assert.equal(kv.has(pollKey), true, "precondition: the lost delete left the poll behind");

  kv.swallowDeleteFor = null;
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема после починки"));
  await tickAt(worker, env, { day: 25, hour: 5 });

  const alerts = kv.json("alerts:log") || [];
  assert.ok(
    alerts.some((a) => a.component === "generatePoll" && /завис/i.test(a.message)),
    `expected an alert about the stale poll, got ${JSON.stringify(alerts)}`,
  );
  assert.equal(kv.json(pollKey).options[0], "Тема после починки 1", "a fresh poll must replace it");
});

test("the challenge still starts even when the poll delete keeps failing", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 25, 5, 0) });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 24, 14, 0) });
  kv.swallowDeleteFor = pollKey;
  stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 4, 0, 0, 2] });

  await tickAt(worker, makeEnv(kv), { hour: 14 });

  const challenge = kv.json(challengeKey);
  assert.equal(challenge.status, "active");
  assert.equal(challenge.topic, "Полузатопленный бальный зал");
});

test("next day the stale poll is discarded and a fresh one is generated", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 24, 5, 0) });
  kv.swallowDeleteFor = null;
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Новая тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 }); // 2026-08-25 05:00, one day later

  const poll = kv.json(pollKey);
  assert.ok(poll.createdAt >= Date.UTC(2026, 7, 25, 0, 0));
  assert.equal(poll.options[0], "Новая тема 1");
});

test("a fresh poll left by the previous day does not leak into today's topic history", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 22, 5, 0) });
  kv.seed(`community:${CHAT}:theme_history:daily`, POLL_OPTIONS);
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Уникальная тема"));

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const history = kv.json(`community:${CHAT}:theme_history:daily`);
  assert.equal(new Set(history).size, history.length, "theme history must not contain duplicates");
});
