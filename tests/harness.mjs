// Minimal test harness: loads the real worker module and runs its `scheduled`
// handler against an in-memory KV and a stubbed Telegram API.
// No dependencies — run with `node --test tests/`.

import { createHash } from "node:crypto";
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
    this.ttls = new Map();
    this.deleteCalls = [];
    /** Set a key name here to simulate a KV delete that silently does not stick. */
    this.swallowDeleteFor = null;
    /** Set a key name here to make writes to it throw, like a KV 429/5xx. */
    this.failPutFor = null;
  }
  async get(key, type) {
    const raw = this.map.get(key);
    if (raw === undefined) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  }
  async put(key, value, options = {}) {
    if (this.failPutFor === key) throw new Error(`KV put failed for ${key}`);
    this.map.set(key, value);
    this.ttls.set(key, options.expirationTtl ?? null);
  }
  /** expirationTtl of the last write, in seconds; null = kept forever. */
  ttl(key) {
    return this.ttls.get(key);
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
 * opts.adminIds → user ids getChatMember reports as administrators.
 * opts.webhookInfo → what getWebhookInfo returns.
 * opts.botUsername → the username getMe returns.
 * opts.rejectSend → predicate on a sendMessage body; matching messages fail with 400.
 * opts.telegramDown → stopPoll fails with a server error.
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

    if (method === "getWebhookInfo") return ok(opts.webhookInfo ?? { url: "" });
    if (method === "getMe") return ok({ id: 1, is_bot: true, username: opts.botUsername ?? "challenge_test_bot" });
    if (method === "sendMessage" && opts.rejectSend?.(body)) {
      return fail(400, "Bad Request: can't parse entities: Unclosed start tag");
    }
    if (method === "stopPoll") {
      if (opts.pollClosed) return fail(400, "Bad Request: poll has already been closed");
      if (opts.telegramDown) return fail(502, "Bad Gateway");
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
    if (method === "getChatMember") {
      const admin = (opts.adminIds || []).includes(body.user_id);
      return ok({ status: admin ? "administrator" : "member", user: { id: body.user_id } });
    }
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

/**
 * AI stub that records every request body. `content` overrides the answer text,
 * `finishReason` and `model` shape the OpenAI-compatible envelope.
 */
export function captureAi(themes, { content, finishReason = "stop", model = "google/gemini-test" } = {}) {
  const requests = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.telegram.org")) {
      requests.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          model,
          choices: [{ message: { content: content ?? JSON.stringify(themes) }, finish_reason: finishReason }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return inner(url, init);
  };
  return requests;
}

/** AI stub that fails the way OpenRouter fails when credits run out. */
export function stubAiFailing(status = 402, message = "This request requires more credits") {
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.telegram.org")) {
      return new Response(JSON.stringify({ error: { message, code: status } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return inner(url, init);
  };
}

export const CHAT = -1001749292934;

/**
 * KV pre-loaded with one community whose daily poll is at 05:00 and challenge at 14:00.
 * `bootstrap: true` leaves cron_state absent, i.e. the very first tick after a deploy.
 */
export function seedCommunity(kv, { schedule, bootstrap = false } = {}) {
  if (!bootstrap) kv.seed(`community:${CHAT}:cron_state`, {});
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
    AI_API_URL: "https://ai.test/v1/chat/completions",
    AI_API_KEY: "test-key",
    AI_MODEL: "test/model",
  };
}

export const ctx = { waitUntil: (p) => p, passThroughOnException: () => {} };

/** The secret the worker expects when WEBHOOK_SECRET is not set: derived from BOT_TOKEN. */
export function derivedWebhookSecret(env) {
  return env.WEBHOOK_SECRET || createHash("sha256").update(`${env.BOT_TOKEN}:webhook`).digest("hex");
}

/** Deliver a Telegram update to the webhook, as Telegram does — with the secret header. */
export function sendUpdate(worker, env, update) {
  return worker.fetch(
    new Request("https://bot.test/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": derivedWebhookSecret(env) },
      body: JSON.stringify(update),
    }),
    env,
  );
}

let updateId = 1000;
/** A group message update from `from` in `thread`. */
export function groupMessage({ text, from = { id: 42, username: "someone", first_name: "Someone" }, thread = 0, extra = {} }) {
  return {
    update_id: ++updateId,
    message: {
      message_id: 5000 + updateId,
      chat: { id: CHAT, type: "supergroup", title: "TEST" },
      from,
      text,
      message_thread_id: thread || undefined,
      ...extra,
    },
  };
}

/**
 * Fire a cron tick the way Cloudflare does — scheduledTime carries seconds.
 * Note: this only moves the *cron* clock. Code that calls Date.now() (poll ageing,
 * challenge startedAt) still sees the real clock, so seed those relative to Date.now().
 */
export function tickAt(worker, env, { year = 2026, month = 7, day = 25, hour, minute = 0, second = 16 }) {
  const at = Date.UTC(year, month, day, hour, minute, second);
  return worker.scheduled({ cron: "* * * * *", scheduledTime: at }, env, ctx);
}
