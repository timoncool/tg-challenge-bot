import { Env, json, makeCookie, verifySecret, clearCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: { secret?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = (body.secret ?? "").trim();
  if (!secret) return json({ error: "Missing secret" }, { status: 400 });

  if (!(await verifySecret(ctx.env, secret))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookie = await makeCookie(ctx.env);
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  return json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
};
