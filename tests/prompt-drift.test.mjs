// The admin panel shows and edits the bot's prompts, and its "AI Test" renders them
// itself. Its defaults are a copy of the bot's built-ins — this keeps the copy honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PROMPTS } from "../admin/functions/_lib/defaultPrompts.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function builtinPrompts() {
  const src = readFileSync(join(HERE, "..", "worker-mr-challenger.js"), "utf8").replace(/\r\n/g, "\n");
  const slice = (start) => {
    const i = src.indexOf(start);
    assert.ok(i >= 0, `${start} not found in the worker`);
    return src.slice(i, src.indexOf("\n};\n", i) + 4);
  };
  const code = slice("const BUILTIN_CORPUS = {") + slice("const BUILTIN_PROMPTS = {");
  return new Function(`${code}\nreturn BUILTIN_PROMPTS;`)();
}

test("admin default prompts equal the bot's built-in prompts", () => {
  const bot = builtinPrompts();
  assert.equal(DEFAULT_PROMPTS.template, bot.template, "template");
  for (const mode of ["vanilla", "medium", "nsfw"]) {
    assert.equal(DEFAULT_PROMPTS.modes[mode].instruction, bot.modes[mode].instruction, `${mode} instruction`);
    assert.deepEqual(DEFAULT_PROMPTS.modes[mode].corpus, bot.modes[mode].corpus, `${mode} corpus`);
  }
});
