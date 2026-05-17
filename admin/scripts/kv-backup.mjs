#!/usr/bin/env node
/**
 * KV Backup for tg-challenge-bot's CHALLENGE_KV namespace.
 *
 * Usage:
 *   1. Copy .env.example → .env.local, fill CF_API_TOKEN (or CF_AUTH_EMAIL+CF_AUTH_KEY)
 *   2. npm run kv:backup
 *
 * Output:
 *   backups/kv-YYYY-MM-DDTHH-mm-ss.json — {meta, data: {key: value}}
 *
 * Safe: read-only. Never writes to Cloudflare.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Load .env.local (no deps, simple parser) ─────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
} else {
  console.error(`❌ .env.local not found at ${envPath}`);
  console.error(`   Copy .env.example → .env.local and fill credentials.`);
  process.exit(1);
}

const {
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  CF_AUTH_EMAIL,
  CF_AUTH_KEY,
  CF_WORKER = "tg-challenge-bot",
  CF_KV_BINDING = "CHALLENGE_KV",
  CF_KV_NAMESPACE_ID,
  CF_KV_NAMESPACE_TITLE,
} = process.env;

if (!CF_ACCOUNT_ID) {
  console.error("❌ CF_ACCOUNT_ID missing in .env.local");
  process.exit(1);
}
if (!CF_API_TOKEN && !(CF_AUTH_EMAIL && CF_AUTH_KEY)) {
  console.error("❌ Provide CF_API_TOKEN OR (CF_AUTH_EMAIL + CF_AUTH_KEY) in .env.local");
  process.exit(1);
}

// ── HTTP helper with auth + basic retry ──────────────────────────────────────
const API_BASE = "https://api.cloudflare.com/client/v4";

function authHeaders() {
  if (CF_API_TOKEN) return { Authorization: `Bearer ${CF_API_TOKEN}` };
  return { "X-Auth-Email": CF_AUTH_EMAIL, "X-Auth-Key": CF_AUTH_KEY };
}

async function cfFetch(pathPart, opts = {}) {
  const url = `${API_BASE}${pathPart}`;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { ...authHeaders(), ...(opts.headers || {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = 1000 * Math.pow(2, attempt);
        console.warn(`  ⏳ ${res.status} on ${pathPart}, retry in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} ${pathPart}: ${body.slice(0, 300)}`);
      }
      // KV value endpoint returns raw bytes, not JSON envelope
      if (pathPart.includes("/values/")) {
        return await res.text();
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(`CF API error: ${JSON.stringify(json.errors)}`);
      }
      return json;
    } catch (e) {
      lastErr = e;
      if (attempt === 3) throw e;
      const wait = 500 * Math.pow(2, attempt);
      console.warn(`  ⚠ ${e.message}, retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── Resolve KV namespace ID ──────────────────────────────────────────────────
// Resolution order (most reliable → fallback):
//   1. Explicit CF_KV_NAMESPACE_ID
//   2. Worker bindings (CF_WORKER + CF_KV_BINDING) — robust against title collisions
//   3. CF_KV_NAMESPACE_TITLE lookup (LEGACY, less safe — multiple namespaces can share titles)
async function resolveNamespace() {
  if (CF_KV_NAMESPACE_ID) {
    return { id: CF_KV_NAMESPACE_ID, source: `explicit CF_KV_NAMESPACE_ID`, title: null };
  }

  if (CF_WORKER && CF_KV_BINDING) {
    console.log(`🔎 Resolving via worker bindings: ${CF_WORKER}.${CF_KV_BINDING}`);
    const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/workers/scripts/${CF_WORKER}/bindings`);
    const binding = (r.result || []).find(
      (b) => b.type === "kv_namespace" && b.name === CF_KV_BINDING
    );
    if (!binding) {
      const all = (r.result || []).filter((b) => b.type === "kv_namespace").map((b) => b.name);
      throw new Error(
        `Binding "${CF_KV_BINDING}" not found on worker "${CF_WORKER}". Available KV bindings: [${all.join(", ")}]`
      );
    }
    // Look up title for human-readable file name
    let title = null;
    try {
      const all = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`);
      title = (all.result || []).find((n) => n.id === binding.namespace_id)?.title || null;
    } catch (e) {
      console.warn(`   ⚠ Could not fetch title: ${e.message}`);
    }
    console.log(`   ✓ ${binding.namespace_id}  (title: ${title || "?"})`);
    return { id: binding.namespace_id, source: `worker:${CF_WORKER}/${CF_KV_BINDING}`, title };
  }

  if (CF_KV_NAMESPACE_TITLE) {
    console.log(`🔎 Looking up namespace by title: ${CF_KV_NAMESPACE_TITLE} (LEGACY — title collisions possible)`);
    const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`);
    const matches = (r.result || []).filter((n) => n.title === CF_KV_NAMESPACE_TITLE);
    if (matches.length === 0) throw new Error(`No namespace with title "${CF_KV_NAMESPACE_TITLE}"`);
    if (matches.length > 1) {
      throw new Error(
        `Multiple namespaces with title "${CF_KV_NAMESPACE_TITLE}": ${matches.map((m) => m.id).join(", ")}. ` +
          `Use CF_WORKER+CF_KV_BINDING or CF_KV_NAMESPACE_ID to disambiguate.`
      );
    }
    return { id: matches[0].id, source: `title:${CF_KV_NAMESPACE_TITLE}`, title: matches[0].title };
  }

  throw new Error(
    "Cannot resolve namespace: set CF_KV_NAMESPACE_ID, or CF_WORKER+CF_KV_BINDING, or CF_KV_NAMESPACE_TITLE"
  );
}

// ── List all keys ────────────────────────────────────────────────────────────
async function listAllKeys(nsId) {
  const keys = [];
  let cursor;
  do {
    const q = new URLSearchParams({ limit: "1000" });
    if (cursor) q.set("cursor", cursor);
    const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${nsId}/keys?${q}`);
    for (const k of r.result) keys.push(k);
    cursor = r.result_info?.cursor || undefined;
    if (cursor) console.log(`  …${keys.length} keys so far, fetching next page`);
  } while (cursor);
  return keys;
}

// ── Fetch one value (returns parsed JSON if possible, else string) ───────────
async function fetchValue(nsId, key) {
  const raw = await cfFetch(
    `/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(key)}`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // not JSON — keep as string
  }
}

// ── Concurrency-limited map ──────────────────────────────────────────────────
async function pMap(items, fn, concurrency = 8) {
  const result = new Array(items.length);
  let i = 0;
  let done = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        result[idx] = await fn(items[idx], idx);
      } catch (e) {
        result[idx] = { __error: e.message };
      }
      done++;
      if (done % 25 === 0 || done === items.length) {
        process.stdout.write(`\r  📥 ${done}/${items.length}`);
      }
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const startedAt = Date.now();
  console.log(`📦 KV backup — account ${CF_ACCOUNT_ID}`);

  const ns = await resolveNamespace();
  const nsId = ns.id;
  console.log(`📋 Listing all keys…`);
  const keyMeta = await listAllKeys(nsId);
  console.log(`   ${keyMeta.length} keys total`);

  if (keyMeta.length === 0) {
    console.warn("⚠ Namespace is empty. Nothing to back up.");
  }

  console.log(`📥 Fetching values (concurrency=8)…`);
  const values = await pMap(keyMeta, (k) => fetchValue(nsId, k.name), 8);

  const data = {};
  let errors = 0;
  for (let i = 0; i < keyMeta.length; i++) {
    const k = keyMeta[i];
    const v = values[i];
    if (v && typeof v === "object" && "__error" in v) {
      errors++;
      console.warn(`  ❌ ${k.name}: ${v.__error}`);
      continue;
    }
    data[k.name] = {
      value: v,
      expiration: k.expiration ?? null, // unix ts when key expires (or null)
      metadata: k.metadata ?? null,
    };
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  // Human-readable env tag based on worker name
  const envTag =
    CF_WORKER === "tg-challenge-bot" ? "prod" :
    CF_WORKER === "tg-test-challange-bot" ? "test" :
    (ns.title || "unknown").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const outPath = path.join(ROOT, "backups", `kv-${envTag}-${stamp}.json`);
  const meta = {
    timestamp: now.toISOString(),
    accountId: CF_ACCOUNT_ID,
    namespaceId: nsId,
    namespaceTitle: ns.title,
    resolvedVia: ns.source,
    worker: CF_WORKER,
    binding: CF_KV_BINDING,
    totalKeys: keyMeta.length,
    backedUp: Object.keys(data).length,
    errors,
    durationMs: Date.now() - startedAt,
    schemaVersion: 1,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ meta, data }, null, 2));

  console.log(`\n✅ Backup saved: ${outPath}`);
  console.log(`   ${meta.backedUp}/${meta.totalKeys} keys, ${meta.errors} errors, ${meta.durationMs}ms`);

  if (errors > 0) {
    console.error(`\n⚠ Backup completed WITH ERRORS. Investigate before deleting source.`);
    process.exit(2);
  }
})().catch((e) => {
  console.error(`\n💥 Backup failed: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
