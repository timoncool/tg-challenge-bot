import { Env, json } from "../../_lib/auth";

// Управление Cron Triggers воркера бота через Cloudflare API.
// Это заменяет ручную раскладку scheduled messages в Telegram.
//
// Бот сам внутри cron'а перебирает все комьюнити и сравнивает текущий час
// с per-community settings:schedule. Поэтому правильное расписание = "0 * * * *"
// (раз в час). За 12 часов до challengeHour делается poll, в challengeHour
// — start.

interface BotEnv extends Env {
  BOT_WORKER_NAME?: string; // default "tg-challenge-bot"
  // Для управления cron нужен CF API token со scope Workers Scripts:Edit
  // (либо Global API Key — read from env)
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  CF_AUTH_EMAIL?: string;
  CF_AUTH_KEY?: string;
}

function cfHeaders(env: BotEnv): Record<string, string> {
  if (env.CF_API_TOKEN) return { Authorization: `Bearer ${env.CF_API_TOKEN}` };
  if (env.CF_AUTH_EMAIL && env.CF_AUTH_KEY)
    return { "X-Auth-Email": env.CF_AUTH_EMAIL, "X-Auth-Key": env.CF_AUTH_KEY };
  return {};
}

function checkCreds(env: BotEnv): string | null {
  if (!env.CF_ACCOUNT_ID) return "CF_ACCOUNT_ID не задан в Pages env";
  if (!env.CF_API_TOKEN && !(env.CF_AUTH_EMAIL && env.CF_AUTH_KEY))
    return "CF_API_TOKEN или (CF_AUTH_EMAIL + CF_AUTH_KEY) не заданы в Pages env";
  return null;
}

const BASE = "https://api.cloudflare.com/client/v4";

export const onRequestGet: PagesFunction<BotEnv> = async (ctx) => {
  const err = checkCreds(ctx.env);
  if (err) return json({ error: err }, { status: 503 });

  const worker = ctx.env.BOT_WORKER_NAME ?? "tg-challenge-bot";
  const url = `${BASE}/accounts/${ctx.env.CF_ACCOUNT_ID}/workers/scripts/${worker}/schedules`;
  const r = await fetch(url, { headers: cfHeaders(ctx.env) });
  const j = (await r.json()) as { success: boolean; result?: { schedules?: { cron: string; created_on?: string; modified_on?: string }[] }; errors?: unknown };
  if (!r.ok || !j.success) {
    return json({ error: "CF API error", details: j.errors }, { status: 502 });
  }
  return json({
    worker,
    schedules: j.result?.schedules ?? [],
  });
};

export const onRequestPut: PagesFunction<BotEnv> = async (ctx) => {
  const err = checkCreds(ctx.env);
  if (err) return json({ error: err }, { status: 503 });

  let body: { schedules: { cron: string }[] };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.schedules)) {
    return json({ error: "schedules must be array of {cron}" }, { status: 400 });
  }

  // Validate cron — 5 fields. We don't restrict individual field syntax here;
  // Cloudflare's API itself validates (and rejects with 400). We just gate the obvious
  // "wrong field count" case to give a friendlier error than the upstream CF response.
  for (const s of body.schedules) {
    if (!s.cron) return json({ error: "cron required" }, { status: 400 });
    const parts = s.cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      return json({ error: `Cron must have 5 fields: "${s.cron}"` }, { status: 400 });
    }
  }

  const worker = ctx.env.BOT_WORKER_NAME ?? "tg-challenge-bot";
  const url = `${BASE}/accounts/${ctx.env.CF_ACCOUNT_ID}/workers/scripts/${worker}/schedules`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { ...cfHeaders(ctx.env), "Content-Type": "application/json" },
    body: JSON.stringify(body.schedules.map((s) => ({ cron: s.cron }))),
  });
  const j = (await r.json()) as { success: boolean; errors?: unknown };
  if (!r.ok || !j.success) {
    return json({ error: "CF API error", details: j.errors }, { status: 502 });
  }
  return json({ ok: true, schedules: body.schedules });
};
