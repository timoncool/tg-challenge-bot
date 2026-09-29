// The admin panel shows and edits the bot's texts; its defaults are a copy of the bot's
// DEFAULT_TEXTS. The public template worker.js is generated from the bot — both must not drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_BOT_MESSAGES } from "../admin/functions/_lib/botMessages.ts";
import { buildTemplate, textsBlock } from "../scripts/build-template.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(ROOT, name), "utf8").replace(/\r\n/g, "\n");

/** Evaluate the texts block of a worker source: `const DEFAULT_TEXTS = {…};`. */
function defaultTexts(source) {
  return new Function(`${textsBlock(source)}\nreturn DEFAULT_TEXTS;`)();
}

test("admin default messages equal the bot's DEFAULT_TEXTS", () => {
  assert.deepEqual(DEFAULT_BOT_MESSAGES, defaultTexts(read("worker-mr-challenger.js")));
});

test("worker.js is the bot built with the neutral texts (run: node scripts/build-template.mjs)", () => {
  assert.equal(read("worker.js"), buildTemplate(read("worker-mr-challenger.js"), read("template/texts.js")));
});

test("the neutral texts cover every key the bot has", () => {
  const bot = defaultTexts(read("worker-mr-challenger.js"));
  const neutral = defaultTexts(read("worker.js"));
  assert.deepEqual(Object.keys(neutral).sort(), Object.keys(bot).sort());
});
