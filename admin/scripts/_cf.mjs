// Tiny shared helper for CF REST API auth (used by all scripts/*.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`❌ .env.local not found at ${envPath}`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
  return { ROOT };
}

export function authHeaders() {
  const { CF_API_TOKEN, CF_AUTH_EMAIL, CF_AUTH_KEY } = process.env;
  if (CF_API_TOKEN) return { Authorization: `Bearer ${CF_API_TOKEN}` };
  if (CF_AUTH_EMAIL && CF_AUTH_KEY) return { "X-Auth-Email": CF_AUTH_EMAIL, "X-Auth-Key": CF_AUTH_KEY };
  console.error("❌ Provide CF_API_TOKEN or (CF_AUTH_EMAIL + CF_AUTH_KEY) in .env.local");
  process.exit(1);
  return {};
}

export const CF_BASE = "https://api.cloudflare.com/client/v4";

export async function cfFetch(pathPart, opts = {}) {
  const res = await fetch(`${CF_BASE}${pathPart}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${pathPart}: ${(await res.text()).slice(0, 300)}`);
    return await res.text();
  }
  const data = await res.json();
  if (!res.ok || (typeof data === "object" && data && "success" in data && !data.success)) {
    const errs = (data && data.errors) ? JSON.stringify(data.errors) : `HTTP ${res.status}`;
    throw new Error(`CF API ${pathPart}: ${errs}`);
  }
  return data;
}
