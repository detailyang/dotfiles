import assert from "node:assert/strict";
import test from "node:test";
import { createWriteToolDefinition, initTheme } from "@earendil-works/pi-coding-agent";
import { installDiffViewTools } from "../extensions/diff-view/renderer/tool/diff/index.ts";

initTheme("dark");

const theme = {
  fg(_color: string, text: string) { return text; },
  bg(_color: string, text: string) { return text; },
  bold(text: string) { return text; },
} as any;

function tools(editSource = "builtin"): any[] {
  const registered: any[] = [];
  installDiffViewTools({
    getAllTools: () => [
      { name: "edit", sourceInfo: { source: editSource } },
      { name: "write", sourceInfo: { source: "builtin" } },
    ],
    registerTool: (tool: unknown) => registered.push(tool),
  } as any);
  return registered;
}

test("edit call slot is empty before, during, and after execution", () => {
  const edit = tools().find((tool) => tool.name === "edit");
  for (const args of [{}, { path: "sample.ts", oldText: "old", newText: "new" }]) {
    for (const context of [
      { argsComplete: false, executionStarted: false },
      { argsComplete: true, executionStarted: true },
      { argsComplete: true, executionStarted: true, expanded: true },
      { argsComplete: true, executionStarted: true, isError: true },
    ]) {
      const component = edit.renderCall(args, theme, { args, state: {}, ...context });
      assert.ok(component, "an absent renderer would trigger Pi's native fallback");
      for (const width of [0, 1, 80, 140]) {
        assert.deepEqual(component.render(width), []);
      }
      component.invalidate();
      assert.deepEqual(component.render(80), []);
    }
  }
});

test("hidden edit call retains the rich diff and visible error results", () => {
  const edit = tools().find((tool) => tool.name === "edit");
  const context = { args: { path: "sample.ts" }, state: {} };
  const rich = edit.renderResult(
    { details: { diff: "@@ -1 +1 @@\n-1|old\n+1|new" }, content: [] },
    { expanded: true }, theme, context,
  );
  const text = rich.render(80).join("\n");
  assert.match(text, /old/);
  assert.match(text, /new/);

  for (const [options, errorContext] of [
    [{ isError: true }, context],
    [{}, { ...context, isError: true }],
  ]) {
    const error = edit.renderResult(
      { content: [{ type: "text", text: "edit failed" }] }, options, theme, errorContext,
    );
    assert.match(error.render(80).join("\n"), /edit failed/);
  }
});

test("write keeps its native call rendering", () => {
  const write = tools().find((tool) => tool.name === "write");
  const native = createWriteToolDefinition(process.cwd()) as any;
  const args = { path: "sample.ts", content: "const value = 1;\n" };
  for (const expanded of [false, true]) {
    const context = () => ({ args, state: {}, argsComplete: true, executionStarted: true, expanded });
    const actual = write.renderCall(args, theme, context());
    const expected = native.renderCall(args, theme, context());
    for (const width of [80, 140]) {
      assert.deepEqual(actual.render(width), expected.render(width));
      assert.ok(actual.render(width).length > 0);
    }
  }
});

test("diff-view does not replace another extension's edit tool", () => {
  assert.deepEqual(tools("extension").map((tool) => tool.name), ["write"]);
});
