// Cloudflare cron is best-effort: `scheduledTime` drifts inside the minute and a
// tick can be dropped. Matching a slot with `h === H && m === M` silently lost a
// whole day's poll or challenge when its one minute went missing, and ran things
// twice when the same minute was delivered twice.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, stubAi, seedCommunity, seedPoll,
  seedActiveChallenge, makeEnv, tickAt, CHAT, POLL_OPTIONS,
} from "./harness.mjs";

const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);
const pollKey = `community:${CHAT}:poll:daily`;
const challengeKey = `community:${CHAT}:challenge:daily`;
const stateKey = `community:${CHAT}:cron_state`;

test("a missed tick is caught up on the next minute", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));

  // 05:00 never arrives — the next tick is 05:01.
  await tickAt(worker, makeEnv(kv), { hour: 5, minute: 1 });

  assert.ok(kv.json(pollKey), "poll must still be created when its exact minute was dropped");
  assert.equal(kv.json(stateKey)["poll:daily"], Date.UTC(2026, 7, 25, 5, 0));
});

test("a tick arriving a second before the slot does not fire it early", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));

  await tickAt(worker, makeEnv(kv), { hour: 4, minute: 59, second: 58 });

  assert.equal(kv.has(pollKey), false, "05:00 slot must not fire at 04:59:58");
});

test("the same minute delivered twice runs the slot once", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedPoll(kv, { createdAt: Date.UTC(2026, 7, 25, 5, 0) });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 24, 14, 0) });
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 4, 0, 0, 2] });

  await tickAt(worker, env, { hour: 14, second: 2 });
  await tickAt(worker, env, { hour: 14, second: 58 });

  const announcements = calls.filter((c) => c.method === "sendMessage").length;
  assert.equal(kv.json(challengeKey).topic, "Полузатопленный бальный зал");
  assert.ok(announcements <= 2, `challenge announced ${announcements} times — slot ran twice`);
});

test("a slot missed by more than the catch-up window is left alone", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));

  // 05:00 slot, tick at 06:30 — almost 90 minutes late, well past the window.
  await tickAt(worker, makeEnv(kv), { hour: 6, minute: 30 });

  assert.equal(kv.has(pollKey), false, "must not fire a slot hours after the fact");
});

test("the first tick after a deploy adopts due slots instead of re-running them", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv, { bootstrap: true });
  // createdAt is relative to the real clock: generatePoll ages polls with Date.now(),
  // while tickAt only moves the simulated cron time.
  seedPoll(kv, { createdAt: Date.now() - 86400_000 });
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 25, 14, 0) });
  const calls = stubTelegram({ options: POLL_OPTIONS, voterCounts: [1, 0, 4, 0, 0, 2] });

  // Deployed at 14:10, ten minutes after the challenge already started.
  await tickAt(worker, makeEnv(kv), { hour: 14, minute: 10 });

  assert.equal(
    calls.filter((c) => c.method === "sendMessage").length, 0,
    "a deploy must not restart a challenge that already ran",
  );
  assert.equal(kv.json(stateKey)["challenge:daily"], Date.UTC(2026, 7, 25, 14, 0));

  // And the following day still works normally.
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Завтрашняя тема"));
  await tickAt(worker, makeEnv(kv), { day: 26, hour: 5 });
  assert.equal(kv.json(pollKey).options[0], "Завтрашняя тема 1");
});

test("weekly and monthly slots resolve to the right day", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv, {
    schedule: {
      daily: { pollHour: 5, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
      // Wednesday poll, Friday challenge
      weekly: { pollDay: 3, pollHour: 8, challengeDay: 5, challengeHour: 18, pollMinute: 0, challengeMinute: 0 },
      monthly: { pollDay: 16, pollHour: 9, challengeDay: 23, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
    },
  });
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Недельная тема"));

  // 2026-08-26 is a Wednesday.
  await tickAt(worker, makeEnv(kv), { day: 26, hour: 8 });

  const weekly = kv.json(`community:${CHAT}:poll:weekly`);
  assert.ok(weekly, "weekly poll must fire on its weekday");
  assert.equal(weekly.options[0], "Недельная тема 1");
  assert.equal(kv.has(`community:${CHAT}:poll:monthly`), false, "monthly must not fire on a weekly day");
});

test("a weekly slot does not fire on the wrong weekday", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема"));

  // 2026-08-25 is a Tuesday; the weekly poll is configured for Wednesday 05:00.
  await tickAt(worker, makeEnv(kv), { day: 25, hour: 5 });

  assert.equal(kv.has(`community:${CHAT}:poll:weekly`), false);
  assert.ok(kv.json(pollKey), "the daily poll still fires");
});

test("a bootstrap tick with nothing due still leaves bootstrap mode", async () => {
  // Deploying at a quiet hour must not make the next slot get adopted instead of run.
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv, { bootstrap: true });
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема дня"));

  await tickAt(worker, env, { hour: 2, minute: 36 }); // nothing scheduled anywhere near
  assert.deepEqual(kv.json(stateKey), {}, "state must be written so bootstrap ends");

  await tickAt(worker, env, { hour: 5 }); // the real 05:00 slot
  assert.equal(kv.json(pollKey)?.options?.[0], "Тема дня 1", "the first slot after a deploy must run");
});
