// AI engine configs as the admin panel stores them must produce the request the provider expects.

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadWorker, FakeKV, stubTelegram, seedCommunity, makeEnv, tickAt, CHAT, POLL_OPTIONS } from "./harness.mjs";

const sixThemes = (prefix) => Array.from({ length: 6 }, (_, i) => `${prefix} ${i + 1}`);

/** Record AI requests and answer in the provider's own format. */
function captureProvider() {
  const requests = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("api.telegram.org")) return inner(url, init);
    requests.push({ url: u, headers: init.headers, body: JSON.parse(init.body) });
    const answer = JSON.stringify(sixThemes("Тема"));
    const payload = u.includes("generativelanguage")
      ? { candidates: [{ content: { parts: [{ text: "мысли", thought: true }, { text: answer.slice(0, 20) }, { text: answer.slice(20) }] } }] }
      : { choices: [{ message: { content: answer }, finish_reason: "stop" }] };
    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  };
  return requests;
}

function globalConfig(kv, cfg) {
  kv.seed("settings:ai:global", { apiKey: "k", ...cfg });
}

test("the Gemini URL's {model} placeholder is filled in, and a split answer is joined", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  globalConfig(kv, {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
  });
  stubTelegram({ options: POLL_OPTIONS });
  const requests = captureProvider();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(kv.json(`community:${CHAT}:poll:daily`).options[0], "Тема 1");
});

test("a custom provider gets an OpenAI-compatible request, as the admin's AI Test sends it", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  globalConfig(kv, { provider: "custom", model: "glm-4", apiUrl: "https://llm.example/v1/chat/completions" });
  stubTelegram({ options: POLL_OPTIONS });
  const requests = captureProvider();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.equal(requests[0].body.model, "glm-4");
  assert.ok(Array.isArray(requests[0].body.messages));
  assert.equal(requests[0].headers.Authorization, "Bearer k");
});

test("an incomplete engine config fails with a readable reason, not a fetch error", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  stubTelegram({ options: POLL_OPTIONS });
  const env = { ...makeEnv(kv), AI_API_URL: undefined };

  await tickAt(worker, env, { hour: 5 });

  const alert = kv.json("alerts:log").find((a) => a.component === "poll:daily");
  assert.match(alert.message, /AI не настроен: нет apiUrl/);
});

test("repeated themes do not make Telegram reject the poll", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  const calls = stubTelegram({ options: POLL_OPTIONS });
  const long = "Очень длинная тема ".repeat(8);
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.telegram.org")) return inner(url, init);
    const themes = ["Маяк", "маяк", `${long}А`, `${long}Б`, "Сад", "Мост"];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(themes) } }] }),
      { headers: { "Content-Type": "application/json" } });
  };

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  const options = calls.find((c) => c.method === "sendPoll").body.options;
  assert.equal(new Set(options.map((o) => o.toLowerCase())).size, options.length, `duplicates in ${JSON.stringify(options)}`);
  assert.ok(options.every((o) => o.length <= 100));
  assert.deepEqual(options.filter((o) => !o.startsWith("Очень")), ["Маяк", "Сад", "Мост"]);
});

test("placeholders inside the edited instruction or corpus are not expanded", async () => {
  const worker = await loadWorker();
  const kv = new FakeKV();
  seedCommunity(kv);
  kv.seed("settings:ai:prompts", {
    template: "{INSTRUCTION} | {SAMPLE}",
    modes: {
      vanilla: { instruction: "не трогай {SAMPLE} и {HISTORY}", corpus: ["пример {TYPE}"] },
      medium: { instruction: "m", corpus: ["m"] },
      nsfw: { instruction: "n", corpus: ["n"] },
    },
  });
  stubTelegram({ options: POLL_OPTIONS });
  const requests = captureProvider();

  await tickAt(worker, makeEnv(kv), { hour: 5 });

  assert.equal(requests[0].body.messages[1].content, "не трогай {SAMPLE} и {HISTORY} | пример {TYPE}");
});
