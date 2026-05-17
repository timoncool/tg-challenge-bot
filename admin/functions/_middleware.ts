import { Env, verifyCookie, unauthorized } from "./_lib/auth";
import { logAuditEvent } from "./_lib/audit";

// Public paths that don't require auth.
const PUBLIC = ["/api/auth/login", "/api/health"];

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // Only guard /api/* routes. Static SPA files pass through untouched.
  if (!url.pathname.startsWith("/api/")) {
    return ctx.next();
  }

  if (PUBLIC.includes(url.pathname)) {
    return ctx.next();
  }

  const ok = await verifyCookie(ctx.request, ctx.env);
  if (!ok) return unauthorized();

  const response = await ctx.next();

  // Best-effort audit log. waitUntil prevents the KV write from delaying the response.
  // Failures inside logAuditEvent are swallowed.
  ctx.waitUntil(logAuditEvent(ctx.env, ctx.request, response.clone()));

  return response;
};
