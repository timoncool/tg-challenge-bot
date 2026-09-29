import { Env, json } from "../../_lib/auth";
import { maskKey, SHARED_TOKENS_KEY } from "../../_lib/aiKeys";

// Keys that contain secrets (AI api keys). GET returns them masked: `apiKey` fields in configs,
// every string in the shared token store.
const SENSITIVE_KEY_PATTERNS = [
  /^settings:ai:global$/,
  /^settings:ai:global:prev$/,
  /^settings:ai:presets$/,
  /^community:-?\d+:settings:ai$/,
];
const SECRET_STORE_KEYS = new Set<string>([SHARED_TOKENS_KEY]);

// Keys that are critical infra — DELETE requires explicit ?confirm=YES_I_KNOW
const CRITICAL_DELETE_KEYS = new Set<string>([
  "communities:list",
  "settings:ai:global",
  "settings:ai:presets",
  "settings:messages",
  "settings:ai:prompts",
  SHARED_TOKENS_KEY,
]);

const SIZE_WARN = 200_000; // 200 KB — warn rather than parse blindly

function isSensitive(key: string): boolean {
  return SECRET_STORE_KEYS.has(key) || SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function maskRecursive(value: unknown, everyString: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => maskRecursive(v, everyString));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string" && (everyString || k === "apiKey")) out[k] = maskKey(v);
      else out[k] = maskRecursive(v, everyString);
    }
    return out;
  }
  return value;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const key = url.searchParams.get("key");
  const force = url.searchParams.get("raw") === "1";
  if (!key) return json({ error: "key required" }, { status: 400 });

  const raw = await ctx.env.CHALLENGE_KV.get(key, "text");
  if (raw === null) return json({ key, value: null, type: "missing" });

  if (raw.length > SIZE_WARN && !force) {
    return json({
      key, value: null, type: "too-large",
      size: raw.length,
      hint: `Value is ${raw.length} bytes — too large to render. Add &raw=1 to force.`,
    });
  }

  try {
    const parsed = JSON.parse(raw);
    const safe = isSensitive(key) ? maskRecursive(parsed, SECRET_STORE_KEYS.has(key)) : parsed;
    return json({ key, value: safe, type: "json", sensitive: isSensitive(key), size: raw.length });
  } catch {
    return json({ key, value: raw, type: "text", sensitive: isSensitive(key), size: raw.length });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const key = url.searchParams.get("key");
  if (!key) return json({ error: "key required" }, { status: 400 });

  if (CRITICAL_DELETE_KEYS.has(key) && url.searchParams.get("confirm") !== "YES_I_KNOW") {
    return json({
      error: "Critical key — append &confirm=YES_I_KNOW to delete",
      key,
    }, { status: 403 });
  }

  await ctx.env.CHALLENGE_KV.delete(key);
  return json({ ok: true, deleted: key });
};
