// API keys of stored AI configs. GET endpoints return them masked, and a form sends back the
// mask, the sentinel or "" when the key was not retyped — none of those is a key to store.

export const SENTINEL_UNCHANGED = "__UNCHANGED__";
export const SHARED_TOKENS_KEY = "secrets:ai:tokens";
const MASK_CHAR = "•";

export type SharedTokens = Record<string, string | undefined>;
type StoredConfig = { provider?: string; apiKey?: string } | null | undefined;

export function maskKey(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return MASK_CHAR.repeat(s.length);
  return s.slice(0, 4) + MASK_CHAR.repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}

/** The key typed into the form, or "" when the form means "keep what is stored". */
export function typedKey(value: unknown): string {
  return typeof value === "string" && value && value !== SENTINEL_UNCHANGED && !value.includes(MASK_CHAR)
    ? value
    : "";
}

/** Typed key > the stored config's key when the provider is the same > the provider's shared token. */
export async function resolveApiKey(
  kv: KVNamespace,
  provider: string,
  typed: unknown,
  previous?: StoredConfig,
): Promise<string> {
  const own = typedKey(typed);
  if (own) return own;
  if (previous?.provider === provider && previous.apiKey) return previous.apiKey;
  const shared = (await kv.get<SharedTokens>(SHARED_TOKENS_KEY, "json")) ?? {};
  return shared[provider] ?? "";
}
