import assert from "node:assert/strict";
import test from "node:test";
import { parseCommandArguments } from "../extensions/shared/arguments.ts";

test("command arguments preserve quoted spaces, empty arguments and literal syntax", () => {
  assert.deepEqual(parseCommandArguments('vim "dir with spaces/file.ts"'), ["vim", "dir with spaces/file.ts"]);
  assert.deepEqual(parseCommandArguments("cmd '' \"\""), ["cmd", "", ""]);
  assert.deepEqual(parseCommandArguments(String.raw`cmd 'C:\Program Files\file' C:\tmp\file dir\ with\ spaces`), ["cmd", "C:\\Program Files\\file", "C:\\tmp\\file", "dir with spaces"]);
  assert.deepEqual(parseCommandArguments("cmd '$HOME' '*.ts' ';'"), ["cmd", "$HOME", "*.ts", ";"]);
  assert.deepEqual(parseCommandArguments("  \n"), []);
  assert.throws(() => parseCommandArguments('cmd "bad'), /Unterminated/);
});
