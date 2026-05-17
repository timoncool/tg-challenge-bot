import { Env, json } from "../../../_lib/auth";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

// Proxy для ручных триггеров: дёргает существующие endpoints воркера бота
//   POST /admin/poll/{type}?chat_id=...
//   POST /admin/start/{type}?chat_id=...
//   POST /admin/finish/{type}?chat_id=...
//
// cancel-poll пока не реализован в самом боте — вернём 501 чтобы UI знал.

interface BotEnv extends Env {
  BOT_WORKER_URL?: string;
  BOT_ADMIN_SECRET?: string;
}

interface TriggerReq {
  action: "poll" | "start" | "finish" | "cancel-poll";
  type: "daily" | "weekly" | "monthly";
}

export const onRequestPost: PagesFunction<BotEnv> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  if (!ctx.env.BOT_WORKER_URL) {
    return json({ error: "BOT_WORKER_URL not configured in Pages env" }, { status: 503 });
  }
  if (!ctx.env.BOT_ADMIN_SECRET) {
    return json(
      { error: "BOT_ADMIN_SECRET не задан. Добавь в Pages → Settings → Environment → BOT_ADMIN_SECRET (значение = ADMIN_SECRET воркера бота)" },
      { status: 503 }
    );
  }

  let body: TriggerReq;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!["poll", "start", "finish", "cancel-poll"].includes(body.action)) {
    return json({ error: "action must be poll|start|finish|cancel-poll" }, { status: 400 });
  }
  if (!["daily", "weekly", "monthly"].includes(body.type)) {
    return json({ error: "type must be daily|weekly|monthly" }, { status: 400 });
  }

  if (body.action === "cancel-poll") {
    return json(
      { error: "cancel-poll пока не реализован в боте — добавится при следующем рефакторе" },
      { status: 501 }
    );
  }

  const url = `${ctx.env.BOT_WORKER_URL.replace(/\/$/, "")}/admin/${body.action}/${body.type}?chat_id=${chatId}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.env.BOT_ADMIN_SECRET}` },
    });
    const text = await r.text();
    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch { /* keep as text */ }

    if (!r.ok) {
      return json(
        { error: `Bot worker returned ${r.status}`, upstream: payload },
        { status: r.status === 401 ? 502 : r.status }
      );
    }

    return json({ ok: true, action: body.action, type: body.type, chatId, upstream: payload });
  } catch (e) {
    return json({ error: `Bot worker fetch failed: ${(e as Error).message}` }, { status: 502 });
  }
};
