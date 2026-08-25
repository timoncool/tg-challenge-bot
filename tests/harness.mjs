// Minimal test harness: loads the real worker module and runs its `scheduled`
// handler against an in-memory KV and a stubbed Telegram API.
// No dependencies — run with `node --test tests/`.

import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The worker is plain .js with no package.json — copy to .mjs so Node loads it as ESM. */
export async function loadWorker() {
  const dir = mkdtempSync(join(tmpdir(), "challenge-bot-test-"));
  const dest = join(dir, "worker.mjs");
  copyFileSync(join(HERE, "..", "worker-mr-challenger.js"), dest);
  return (await import(pathToFileURL(dest).href)).default;
}

export class FakeKV {
  constructor() {
    this.map = new Map();
    this.deleteCalls = [];
    /** Set a key name here to simulate a KV delete that silently does not stick. */
    this.swallowDeleteFor = null;
  }
  async get(key, type) {
    const raw = this.map.get(key);
    if (raw === undefined) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  }
  async put(key, value) {
    this.map.set(key, value);
  }
  async delete(key) {
    this.deleteCalls.push(key);
    if (this.swallowDeleteFor === key) return; // lost delete, as seen in production
    this.map.delete(key);
  }
  async list({ prefix } = {}) {
    const keys = [...this.map.keys()]
      .filter((k) => !prefix || k.startsWith(prefix))
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor: "" };
  }
  seed(key, value) {
    this.map.set(key, JSON.stringify(value));
  }
  has(key) {
    return this.map.has(key);
  }
  json(key) {
    const raw = this.map.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  }
}

/**
 * Stub api.telegram.org.
 * opts.pollClosed → stopPoll fails the way Telegram fails for an already-closed poll.
 * opts.voterCounts → per-option vote counts for stopPoll.
 */
export function stubTelegram(opts = {}) {
  const calls = [];
  let messageId = 200000;

  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, body });

    const ok = (result) =>
      new Response(JSON.stringify({ ok: true, result }), {
        headers: { "Content-Type": "application/json" },
      });
    const fail = (code, description) =>
      new Response(JSON.stringify({ ok: false, error_code: code, description }), {
        headers: { "Content-Type": "application/json" },
      });

    if (method === "stopPoll") {
      if (opts.pollClosed) return fail(400, "Bad Request: poll has already been closed");
      return ok({
        id: String(body.message_id),
        is_closed: true,
        options: (opts.options || []).map((text, i) => ({
          text,
          voter_count: (opts.voterCounts || [])[i] ?? 0,
        })),
      });
    }
    if (method === "sendPoll") return ok({ message_id: ++messageId, poll: { id: "poll-new" } });
    if (method === "sendMessage" || method === "forwardMessage") return ok({ message_id: ++messageId });
    return ok(true);
  };

  return calls;
}

/** AI stub — the worker calls OpenRouter/Gemini through the same global fetch. */
export function stubAi(themes) {
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes("api.telegram.org")) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(themes) } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return inner(url, init);
  };
}

export const CHAT = -1001749292934;

/** KV pre-loaded with one community whose daily poll is at 05:00 and challenge at 14:00. */
export function seedCommunity(kv, { schedule } = {}) {
  kv.seed("communities:list", { [String(CHAT)]: { chatId: CHAT, name: "TEST", addedAt: 1 } });
  kv.seed(`community:${CHAT}:settings:topics`, { daily: 4, weekly: 8, monthly: 6, winners: 999 });
  kv.seed(`community:${CHAT}:settings:schedule`, schedule ?? {
    daily: { pollHour: 5, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
    weekly: { pollDay: 3, pollHour: 5, challengeDay: 5, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
    monthly: { pollDay: 16, pollHour: 9, challengeDay: 23, challengeHour: 14, pollMinute: 0, challengeMinute: 0 },
  });
}

export const POLL_OPTIONS = [
  "Корво Аттано (Dishonored)",
  "Взлом криогенной капсулы",
  "Полузатопленный бальный зал",
  "Стиль: кислотный нео-нуар",
  "Пробирка со светящимся ядом",
  "Охотница за головами в неоновом плаще",
];

export function seedPoll(kv, { createdAt, type = "daily", options = POLL_OPTIONS }) {
  kv.seed(`community:${CHAT}:poll:${type}`, {
    type,
    pollId: "5208491743049160118",
    messageId: 138336,
    options,
    createdAt,
    topicThreadId: 4,
    suggestionIds: [],
  });
}

export function seedActiveChallenge(kv, { type = "daily", startedAt, topic = "Прошлая тема" }) {
  kv.seed(`community:${CHAT}:challenge:${type}`, {
    id: 20260823111,
    type,
    topic,
    topicFull: topic,
    status: "active",
    startedAt,
    endsAt: startedAt + 86400_000,
    topicThreadId: 4,
    announcementMessageId: 138300,
  });
}

export function makeEnv(kv) {
  return {
    CHALLENGE_KV: kv,
    BOT_TOKEN: "test:token",
    ADMIN_SECRET: "secret",
    AI_PROVIDER: "openrouter",
    AI_API_KEY: "test-key",
    AI_MODEL: "test/model",
  };
}

export const ctx = { waitUntil: (p) => p, passThroughOnException: () => {} };

/** Fire a cron tick the way Cloudflare does — scheduledTime carries seconds. */
export function tickAt(worker, env, { year = 2026, month = 7, day = 25, hour, minute = 0, second = 16 }) {
  const at = Date.UTC(year, month, day, hour, minute, second);
  return worker.scheduled({ cron: "* * * * *", scheduledTime: at }, env, ctx);
}
