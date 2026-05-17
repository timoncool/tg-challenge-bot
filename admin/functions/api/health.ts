import { json, Env } from "../_lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return json({
    ok: true,
    service: "tg-challenge-bot-admin",
    version: "0.0.1",
    hasKv: !!ctx.env.CHALLENGE_KV,
    hasSecret: !!ctx.env.ADMIN_SECRET,
    hasHmac: !!ctx.env.AUTH_HMAC_KEY,
    time: Date.now(),
  });
};
