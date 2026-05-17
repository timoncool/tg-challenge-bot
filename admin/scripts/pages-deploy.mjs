#!/usr/bin/env node
/**
 * Direct upload deploy: POST every file in dist/ + functions/ to Cloudflare Pages
 * via REST API (no wrangler). Uses the "direct upload" deployment flow.
 *
 * Cloudflare Pages direct upload accepts a multipart/form-data POST with all
 * static assets and a special _redirects/_routes.json/_headers files.
 * Pages Functions live in functions/ — Pages bundles them server-side when the
 * project is connected to a build, but for direct upload we can include
 * compiled functions via a _worker.js OR use the new "functions" directory
 * via the bulk upload manifest API.
 *
 * Simplest reliable path (used by `wrangler pages deploy` under the hood):
 *   1. POST /accounts/{id}/pages/projects/{p}/upload-token  → token for assets
 *   2. POST manifest with hashes of files → CF returns missing hashes
 *   3. POST missing files in batches
 *   4. POST /accounts/{id}/pages/projects/{p}/deployments with form data
 *      (manifest, functions dir as tarball)
 *
 * Direct REST equivalent of wrangler is ~150 lines; we use it.
 *
 * Refs:
 *   https://developers.cloudflare.com/api/operations/pages-project-create-deployment
 *   https://developers.cloudflare.com/pages/platform/api/
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadEnv, cfFetch, authHeaders, CF_BASE } from "./_cf.mjs";

const { ROOT } = loadEnv();
const { CF_ACCOUNT_ID, PAGES_PROJECT_NAME = "tg-challenge-bot-admin" } = process.env;

if (!CF_ACCOUNT_ID) {
  console.error("❌ CF_ACCOUNT_ID required");
  process.exit(1);
}

const DIST = path.join(ROOT, "dist");
const FUNCTIONS = path.join(ROOT, "functions");

if (!fs.existsSync(DIST)) {
  console.error(`❌ ${DIST} not found — run \`npm run build\` first`);
  process.exit(1);
}

// ── 1. Walk dist/ and hash every file ───────────────────────────────────────
function* walk(dir, base = dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, base);
    else yield { full, rel: path.relative(base, full).replace(/\\/g, "/") };
  }
}

function sha256Base64(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

console.log("📦 Hashing static assets in dist/…");
const assets = [];
for (const { full, rel } of walk(DIST)) {
  const buf = fs.readFileSync(full);
  const hash = sha256Base64(buf).slice(0, 32); // CF wants 32-char hex
  const ext = path.extname(rel).slice(1);
  assets.push({
    rel,
    buf,
    hash,
    base64: buf.toString("base64"),
    contentType: guessMime(ext),
  });
}
console.log(`   ${assets.length} files`);

// ── 2. Get upload JWT (or use account auth) ─────────────────────────────────
console.log("🔑 Getting upload JWT…");
const tokenResp = await cfFetch(
  `/accounts/${CF_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT_NAME}/upload-token`
);
const jwt = tokenResp.result.jwt;
console.log("   ✓ got JWT");

// ── 3. Check missing hashes (CF only wants files it doesn't have) ──────────
console.log("🔎 Checking missing hashes…");
const checkResp = await fetch(`${CF_BASE}/pages/assets/check-missing`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ hashes: assets.map((a) => a.hash) }),
});
const checkJson = await checkResp.json();
if (!checkJson.success) {
  console.error("❌ check-missing failed:", JSON.stringify(checkJson.errors));
  process.exit(1);
}
const missing = new Set(checkJson.result || []);
console.log(`   ${missing.size}/${assets.length} need upload`);

// ── 4. Upload missing in batches of 5 MB ────────────────────────────────────
const BATCH_BYTES = 5 * 1024 * 1024;
const toUpload = assets.filter((a) => missing.has(a.hash));
let uploaded = 0;
while (toUpload.length) {
  const batch = [];
  let size = 0;
  while (toUpload.length && size < BATCH_BYTES) {
    const a = toUpload.shift();
    batch.push({
      base64: true,
      key: a.hash,
      value: a.base64,
      metadata: { contentType: a.contentType },
    });
    size += a.buf.length;
  }
  const r = await fetch(`${CF_BASE}/pages/assets/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ payload: batch }),
  });
  const j = await r.json();
  if (!j.success) {
    console.error("❌ asset upload failed:", JSON.stringify(j.errors));
    process.exit(1);
  }
  uploaded += batch.length;
  process.stdout.write(`\r  📤 ${uploaded}/${missing.size}`);
}
if (missing.size > 0) process.stdout.write("\n");

// ── 5. Build manifest { "/path": "hash" } ───────────────────────────────────
const manifest = {};
for (const a of assets) manifest["/" + a.rel] = a.hash;

// ── 6. POST deployment ──────────────────────────────────────────────────────
console.log("🚀 Creating deployment…");

const form = new FormData();
form.append("manifest", JSON.stringify(manifest));

// Bundle functions/ as a directory tarball — Pages compiles them server-side.
// Cloudflare's direct-upload accepts a file field per function.
async function appendFunctions() {
  if (!fs.existsSync(FUNCTIONS)) return;
  let count = 0;
  for (const { full, rel } of walk(FUNCTIONS, FUNCTIONS)) {
    if (!/\.(ts|js|mjs)$/.test(rel)) continue;
    const buf = fs.readFileSync(full);
    const blob = new Blob([buf], { type: "application/javascript" });
    form.append(`functions/${rel}`, blob, rel);
    count++;
  }
  console.log(`   bundled ${count} function files`);
}
await appendFunctions();

const deployRes = await fetch(
  `${CF_BASE}/accounts/${CF_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT_NAME}/deployments`,
  {
    method: "POST",
    headers: authHeaders(),
    body: form,
  }
);
const deployJson = await deployRes.json();
if (!deployJson.success) {
  console.error("❌ deployment failed:", JSON.stringify(deployJson.errors, null, 2));
  process.exit(1);
}

const d = deployJson.result;
console.log(`\n✅ Deployed`);
console.log(`   id:    ${d.id}`);
console.log(`   url:   ${d.url}`);
console.log(`   alias: https://${d.aliases?.[0] ?? `${PAGES_PROJECT_NAME}.pages.dev`}`);

function guessMime(ext) {
  return {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    txt: "text/plain; charset=utf-8",
    map: "application/json; charset=utf-8",
  }[ext] ?? "application/octet-stream";
}
