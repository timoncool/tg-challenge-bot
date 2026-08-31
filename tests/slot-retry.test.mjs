// Production incident 2026-08-29: OpenRouter credits ran out, every AI call
// returned 402. The slot was marked done *before* the action ran, so all three
// groups silently went a full day with no challenge at all — and nothing was
// reported anywhere. A failed slot must retry by itself and be reported.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadWorker, FakeKV, stubTelegram, stubAi, stubAiFailing, seedCommunity,
  seedActiveChallenge, makeEnv, tickAt, CHAT, POLL_OPTIONS,
} from "./harness.mjs";

const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);
const pollKey = `community:${CHAT}:poll:daily`;
const challengeKey = `community:${CHAT}:challenge:daily`;
const stateKey = `community:${CHAT}:cron_state`;

test("a slot whose action failed is not marked done", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const state = kv.json(stateKey);
  assert.equal(kv.has(pollKey), false, "precondition: the poll could not be created");
  assert.notEqual(
    state["poll:daily"], Date.UTC(2026, 7, 25, 5, 0),
    "a failed slot must not count as done, otherwise it is skipped for a whole day",
  );
});

test("a failed slot retries by itself once the provider recovers", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);

  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();
  await tickAt(worker, env, { hour: 5 });
  assert.equal(kv.has(pollKey), false);

  // Credits topped up 20 minutes later — the next tick must pick the slot back up.
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Тема после пополнения"));
  await tickAt(worker, env, { hour: 5, minute: 20 });

  assert.equal(kv.json(pollKey)?.options?.[0], "Тема после пополнения 1");
  assert.equal(kv.json(stateKey)["poll:daily"], Date.UTC(2026, 7, 25, 5, 0), "slot is done once it succeeded");
});

test("a challenge that could not start retries instead of losing the day", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  seedActiveChallenge(kv, { startedAt: Date.UTC(2026, 7, 24, 14, 0) });

  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();
  await tickAt(worker, env, { hour: 14 });
  assert.equal(kv.json(challengeKey).status, "finished", "yesterday's challenge is closed");
  assert.equal(kv.json(challengeKey).startedAt, Date.UTC(2026, 7, 24, 14, 0), "no new challenge yet");

  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Аварийная тема"));
  await tickAt(worker, env, { hour: 14, minute: 25 });

  const ch = kv.json(challengeKey);
  assert.equal(ch.status, "active");
  assert.equal(ch.topic, "Аварийная тема 1");
});

test("retries are throttled, not hammered every minute", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  let aiCalls = 0;
  stubTelegram({ options: POLL_OPTIONS });
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.telegram.org")) {
      aiCalls++;
      return new Response(JSON.stringify({ error: { message: "no credits", code: 402 } }), { status: 402 });
    }
    return inner(url, init);
  };

  for (let m = 0; m <= 6; m++) await tickAt(worker, env, { hour: 5, minute: m });

  assert.ok(aiCalls <= 2, `provider hit ${aiCalls} times in 7 minutes — retries are not throttled`);
});

test("a slot that keeps failing is eventually given up on", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();
  await tickAt(worker, env, { hour: 5 });

  // Ten hours later the slot for the *next* cycle is what matters, not this one.
  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Слишком поздно"));
  await tickAt(worker, env, { hour: 15 });

  assert.equal(kv.has(pollKey), false, "must not create yesterday's poll half a day late");
});

test("a failed slot is written to the alert log", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const alerts = kv.json("alerts:log") || [];
  assert.ok(
    alerts.some((a) => a.severity === "error" && /дневной опрос/i.test(a.message)),
    `expected a readable alert about the failed slot, got ${JSON.stringify(alerts)}`,
  );
});

test("the owner is notified in DM when a slot fails", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:owner_chat_id", 172593406);
  const calls = stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const dm = calls.find((c) => c.method === "sendMessage" && c.body.chat_id === 172593406);
  assert.ok(dm, "expected a DM to the owner about the failure");
  assert.match(dm.body.text, /дневной опрос/i, "the DM must name what failed in plain words");
  assert.match(dm.body.text, /«TEST»/, "the DM must name the community, not just its chat id");
  assert.doesNotMatch(dm.body.text, /poll:daily/, "no internal slot keys in a DM");
});

test("no owner configured — failure is still logged, nothing crashes", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  stubAiFailing();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.ok((kv.json("alerts:log") || []).length > 0);
});

test("a truncated AI answer counts as a failure and is retried", async () => {
  // 31.08: max_tokens was too low for a thinking model, the JSON array came back
  // cut in half and JSON.parse threw. That must behave like any other failure.
  const worker = await loadWorker();
  const kv = new FakeKV();
  const env = makeEnv(kv);
  seedCommunity(kv);

  stubTelegram({ options: POLL_OPTIONS });
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.telegram.org")) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '[\n  "Питер Пэн",\n  "Кормление карпов кои в тихо' } }],
        usage: { prompt_tokens: 600, completion_tokens: 2000, total_tokens: 2600 },
      }), { headers: { "Content-Type": "application/json" } });
    }
    return inner(url, init);
  };

  await tickAt(worker, env, { hour: 5 });
  assert.equal(kv.has(pollKey), false, "a cut-off answer must not produce a poll");
  assert.notEqual(kv.json(stateKey)["poll:daily"], Date.UTC(2026, 7, 25, 5, 0));

  stubTelegram({ options: POLL_OPTIONS });
  stubAi(sixThemes("Полный ответ"));
  await tickAt(worker, env, { hour: 5, minute: 15 });
  assert.equal(kv.json(pollKey)?.options?.[0], "Полный ответ 1", "the retry must recover it");
});
