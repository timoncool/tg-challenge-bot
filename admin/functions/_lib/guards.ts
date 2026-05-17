// Shared guards for per-chatId endpoints.

import { AdminStorage } from "./storage";
import { json, Env } from "./auth";

type Community = { chatId: number; name: string; addedAt: number };

interface GuardErr { error: Response; chatId?: undefined; community?: undefined; }
interface GuardOk  { chatId: number; community: Community; error?: undefined; }
export type GuardResult = GuardErr | GuardOk;

export function isGuardErr(g: GuardResult): g is GuardErr {
  return (g as GuardErr).error !== undefined;
}

/**
 * Ensures community exists in `communities:list`. Returns error Response or {chatId, community}.
 * Usage:
 *   const g = await requireCommunity(ctx.env, ctx.params.chatId as string);
 *   if (isGuardErr(g)) return g.error;
 *   const { chatId } = g;
 */
export async function requireCommunity(env: Env, chatIdParam: string | undefined): Promise<GuardResult> {
  if (!chatIdParam) {
    return { error: json({ error: "Missing chatId" }, { status: 400 }) };
  }
  const chatId = parseInt(chatIdParam, 10);
  if (!Number.isFinite(chatId)) {
    return { error: json({ error: "Invalid chatId" }, { status: 400 }) };
  }
  const storage = new AdminStorage(env.CHALLENGE_KV);
  const all = await storage.getCommunities();
  const community = all[String(chatId)];
  if (!community) {
    return { error: json({ error: "Community not registered" }, { status: 404 }) };
  }
  return { chatId, community };
}
