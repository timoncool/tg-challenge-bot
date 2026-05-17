import { Env, json } from "../../_lib/auth";

// POST /api/ai/tokens-test  { provider: "openrouter" | "gemini", token?: string }
// If token is omitted → uses the stored shared token for that provider.

const KEY = "secrets:ai:tokens";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: { provider?: string; token?: string };
  try { body = await ctx.request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }

  const provider = body.provider;
  if (provider !== "openrouter" && provider !== "gemini") {
    return json({ error: "provider must be openrouter or gemini" }, { status: 400 });
  }

  let token = body.token ?? "";
  if (!token) {
    const stored = (await ctx.env.CHALLENGE_KV.get<{ openrouter?: string; gemini?: string }>(KEY, "json")) ?? {};
    token = stored[provider] ?? "";
  }
  if (!token) return json({ ok: false, error: "Нет токена для теста" }, { status: 400 });

  const startedAt = Date.now();
  try {
    if (provider === "openrouter") {
      const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) return json({ ok: false, status: r.status, error: j?.error?.message ?? "Invalid token", elapsedMs: Date.now() - startedAt });
      return json({
        ok: true, status: r.status, elapsedMs: Date.now() - startedAt,
        label: j?.data?.label ?? null,
        usage: j?.data?.usage ?? null,
        limit: j?.data?.limit ?? null,
        rate_limit: j?.data?.rate_limit ?? null,
      });
    }
    // gemini — list models endpoint requires key in URL or x-goog-api-key
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": token },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, status: r.status, error: j?.error?.message ?? "Invalid token", elapsedMs: Date.now() - startedAt });
    return json({ ok: true, status: r.status, elapsedMs: Date.now() - startedAt, sample: j?.models?.[0]?.name ?? null });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 300), elapsedMs: Date.now() - startedAt });
  }
};
