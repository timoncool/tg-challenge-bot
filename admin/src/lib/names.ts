// How the bot names a participant (displayName in worker-mr-challenger.js): `tgUsername` is the
// real Telegram username; older records only have `username`, which may be a first name.

interface Named {
  userId: number;
  username?: string;
  tgUsername?: string | null;
}

export function displayName(entry: Named): string {
  if (entry.tgUsername) return `@${entry.tgUsername}`;
  if ("tgUsername" in entry) return entry.username || `user${entry.userId}`;
  const u = entry.username;
  if (u && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u)) return `@${u}`;
  return u || `user${entry.userId}`;
}
