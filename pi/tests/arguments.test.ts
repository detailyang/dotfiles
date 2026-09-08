import assert from "node:assert/strict";
import test from "node:test";
import { parseCommandArguments } from "../extensions/shared/arguments.ts";
import run from "../extensions/run/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

test("command arguments preserve quoted spaces, empty arguments and literal syntax", () => {
  assert.deepEqual(parseCommandArguments('vim "dir with spaces/file.ts"'), ["vim", "dir with spaces/file.ts"]);
  assert.deepEqual(parseCommandArguments("cmd '' \"\""), ["cmd", "", ""]);
  assert.deepEqual(parseCommandArguments(String.raw`cmd 'C:\Program Files\file' C:\tmp\file dir\ with\ spaces`), ["cmd", "C:\\Program Files\\file", "C:\\tmp\\file", "dir with spaces"]);
  assert.deepEqual(parseCommandArguments("cmd '$HOME' '*.ts' ';'"), ["cmd", "$HOME", "*.ts", ";"]);
  assert.deepEqual(parseCommandArguments("  \n"), []);
  assert.throws(() => parseCommandArguments('cmd "bad'), /Unterminated/);
});

test("empty or malformed /t arguments never stop the terminal or spawn", async () => {
  const h = createExtensionHarness(run);
  h.ctx.mode = "tui";
  h.ctx.ui.custom = () => assert.fail("terminal must not be stopped");
  await h.command("t", "");
  await h.command("t", "\"\"");
  await h.command("t", 'vim "bad');
  assert.equal(h.notices.length, 3);
});
