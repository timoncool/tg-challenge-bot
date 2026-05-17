#!/usr/bin/env node
/**
 * One-time setup: create the Pages project (if missing) and bind:
 *   - KV namespace: CHALLENGE_KV  → prod KV (599c3ef3...)
 *   - env vars: ADMIN_SECRET, AUTH_HMAC_KEY, BOT_WORKER_URL, BOT_ADMIN_SECRET
 *
 * Idempotent — re-run anytime to sync settings.
 *
 * Reads from .env.local:
 *   CF_ACCOUNT_ID
 *   CF_AUTH_EMAIL + CF_AUTH_KEY  (or CF_API_TOKEN)
 *   PAGES_PROJECT_NAME  (default: tg-challenge-bot-admin)
 *   PAGES_PROD_KV_ID    (default: 599c3ef3... — auto-resolved from worker)
 *   PAGES_TEST_KV_ID    (default: 69b8fd57... — for preview env)
 *   PAGES_ADMIN_SECRET            — value for admin login (required)
 *   PAGES_AUTH_HMAC_KEY           — random ≥32-char string (required)
 *   PAGES_BOT_WORKER_URL          — https://tg-challenge-bot.timoncool.workers.dev (required for triggers)
 *   PAGES_BOT_ADMIN_SECRET        — same ADMIN_SECRET that's set on the bot worker (for trigger proxy)
 */
import { loadEnv, cfFetch } from "./_cf.mjs";

const { } = loadEnv();
const {
  CF_ACCOUNT_ID,
  PAGES_PROJECT_NAME = "tg-challenge-bot-admin",
  PAGES_PROD_KV_ID,
  PAGES_TEST_KV_ID,
  PAGES_ADMIN_SECRET,
  PAGES_AUTH_HMAC_KEY,
  PAGES_BOT_WORKER_URL,
  PAGES_BOT_ADMIN_SECRET,
} = process.env;

if (!CF_ACCOUNT_ID) {
  console.error("❌ CF_ACCOUNT_ID required");
  process.exit(1);
}

// Auto-resolve KV namespace IDs from worker bindings if not provided explicitly.
async function resolveBotKv(worker) {
  console.log(`🔎 Resolving CHALLENGE_KV from worker ${worker}`);
  const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/workers/scripts/${worker}/bindings`);
  const b = (r.result || []).find((x) => x.type === "kv_namespace" && x.name === "CHALLENGE_KV");
  if (!b) throw new Error(`No CHALLENGE_KV binding on ${worker}`);
  return b.namespace_id;
}

const prodKv = PAGES_PROD_KV_ID || (await resolveBotKv("tg-challenge-bot"));
const testKv = PAGES_TEST_KV_ID || (await resolveBotKv("tg-test-challange-bot"));
console.log(`   PROD KV: ${prodKv}`);
console.log(`   TEST KV: ${testKv}`);

// 1. Find or create project.
console.log(`📦 Checking Pages project: ${PAGES_PROJECT_NAME}`);
let project;
try {
  const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT_NAME}`);
  project = r.result;
  console.log(`   ✓ exists`);
} catch (e) {
  if (!String(e.message).includes("not found") && !String(e.message).includes("8000007")) {
    // Heuristic — try to create anyway.
  }
  console.log(`   creating…`);
  const r = await cfFetch(`/accounts/${CF_ACCOUNT_ID}/pages/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: PAGES_PROJECT_NAME,
      production_branch: "main",
    }),
  });
  project = r.result;
  console.log(`   ✓ created`);
}

// 2. Update production + preview environments with KV bindings and secrets.
function buildEnvPatch(kvId) {
  const env = {
    kv_namespaces: {
      CHALLENGE_KV: { namespace_id: kvId },
    },
    env_vars: {},
  };
  if (PAGES_ADMIN_SECRET) env.env_vars.ADMIN_SECRET = { type: "secret_text", value: PAGES_ADMIN_SECRET };
  if (PAGES_AUTH_HMAC_KEY) env.env_vars.AUTH_HMAC_KEY = { type: "secret_text", value: PAGES_AUTH_HMAC_KEY };
  if (PAGES_BOT_WORKER_URL) env.env_vars.BOT_WORKER_URL = { type: "plain_text", value: PAGES_BOT_WORKER_URL };
  if (PAGES_BOT_ADMIN_SECRET) env.env_vars.BOT_ADMIN_SECRET = { type: "secret_text", value: PAGES_BOT_ADMIN_SECRET };
  return env;
}

console.log(`🔧 Patching deployment_configs (production + preview)…`);
await cfFetch(`/accounts/${CF_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT_NAME}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    deployment_configs: {
      production: buildEnvPatch(prodKv),
      preview: buildEnvPatch(testKv),
    },
  }),
});
console.log(`   ✓ deployment configs updated`);

console.log(`\n✅ Setup done.`);
console.log(`   Production binds CHALLENGE_KV → ${prodKv} (real prod data)`);
console.log(`   Preview    binds CHALLENGE_KV → ${testKv} (test data only)`);
console.log(`\nNext: npm run pages:deploy`);
