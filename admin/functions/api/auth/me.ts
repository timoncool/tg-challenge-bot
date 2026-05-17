import { Env, json } from "../../_lib/auth";

// Middleware already verified the cookie if we got here. Just confirm.
export const onRequestGet: PagesFunction<Env> = async () => {
  return json({ ok: true });
};
