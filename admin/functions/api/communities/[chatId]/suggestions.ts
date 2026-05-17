import { Env, json } from "../../../_lib/auth";
import { AdminStorage, ChallengeType } from "../../../_lib/storage";
import { requireCommunity, isGuardErr } from "../../../_lib/guards";

const isValidType = (t: string): t is ChallengeType => ["daily","weekly","monthly"].includes(t);

// GET    /api/communities/{chatId}/suggestions?type=daily|all
// DELETE /api/communities/{chatId}/suggestions?type=daily
// POST   /api/communities/{chatId}/suggestions/approve { id, type } — bumps reactionCount to threshold

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const url = new URL(ctx.request.url);
  const t = url.searchParams.get("type") ?? "all";
  if (t !== "all" && !isValidType(t)) return json({ error: "bad type" }, { status: 400 });
  const types: ChallengeType[] = t === "all" ? ["daily","weekly","monthly"] : [t as ChallengeType];

  const s = new AdminStorage(ctx.env.CHALLENGE_KV);
  const min = await s.getMinSuggestionReactions(chatId);

  const data = await Promise.all(
    types.map(async (type) => ({
      type,
      min,
      suggestions: (await s.getSuggestions(chatId, type)).sort(
        (a, b) => (b.reactionCount ?? 0) - (a.reactionCount ?? 0)
      ),
    }))
  );

  return json({ chatId, minRequired: min, perType: data });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  const url = new URL(ctx.request.url);
  const t = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  const kv = ctx.env.CHALLENGE_KV;

  if (id) {
    if (!t || !isValidType(t)) {
      return json({ error: "valid type required when id is given" }, { status: 400 });
    }
    const s = new AdminStorage(kv);
    const list = await s.getSuggestions(chatId, t as ChallengeType);
    const next = list.filter((x) => x.id !== id);
    await kv.put(`community:${chatId}:suggestions:${t}`, JSON.stringify(next), { expirationTtl: 7 * 24 * 3600 });
    return json({ ok: true, removed: list.length - next.length });
  }

  // clear all of a type, or all types
  if (t && !isValidType(t)) return json({ error: "bad type" }, { status: 400 });
  // Default-nuke-all is destructive — require explicit confirm when no type/id given
  if (!t && !id && url.searchParams.get("confirm") !== "all") {
    return json({
      error: "Wipe of all 3 types is destructive. Add ?confirm=all or pass ?type=daily|weekly|monthly",
    }, { status: 403 });
  }
  const types = t ? [t as ChallengeType] : (["daily","weekly","monthly"] as const);
  let cleared = 0;
  for (const tp of types) {
    const s = new AdminStorage(kv);
    const cur = await s.getSuggestions(chatId, tp);
    cleared += cur.length;
    await kv.delete(`community:${chatId}:suggestions:${tp}`);
  }
  return json({ ok: true, cleared });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  // PATCH approves a suggestion by bumping reactionCount to min+
  const guard = await requireCommunity(ctx.env, ctx.params.chatId as string);
  if (isGuardErr(guard)) return guard.error;
  const { chatId } = guard;

  let body: { id?: string; type?: ChallengeType; action?: "approve" };
  try { body = await ctx.request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.id || !body.type || !isValidType(body.type)) {
    return json({ error: "id and valid type required" }, { status: 400 });
  }

  const kv = ctx.env.CHALLENGE_KV;
  const s = new AdminStorage(kv);
  const min = await s.getMinSuggestionReactions(chatId);
  const list = await s.getSuggestions(chatId, body.type);
  const sug = list.find((x) => x.id === body.id);
  if (!sug) return json({ error: "suggestion not found" }, { status: 404 });

  if (body.action === "approve") {
    // Inject N synthetic admin reactions to push it over threshold
    sug.reactions = sug.reactions || {};
    for (let i = 0; i < min; i++) sug.reactions[`__admin_force_${i}`] = 1;
    sug.reactionCount = Object.keys(sug.reactions).length;
    await kv.put(`community:${chatId}:suggestions:${body.type}`, JSON.stringify(list), { expirationTtl: 7 * 24 * 3600 });
    return json({ ok: true, suggestion: sug });
  }

  return json({ error: "unknown action" }, { status: 400 });
};
