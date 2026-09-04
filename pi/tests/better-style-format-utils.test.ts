import assert from "node:assert/strict";
import test from "node:test";
import { oneLine } from "../extensions/better-style/utils/format.ts";

test("oneLine: 默认 max=96，超长截断加省略号", () => {
	const long = "x".repeat(120);
	const out = oneLine(long);
	assert.equal(out.length, 96);
	assert.equal(out.endsWith("…"), true);
	assert.equal(out, `${"x".repeat(95)}…`);
});

test("oneLine: 显式 max 覆盖默认；空白折叠为单行", () => {
	assert.equal(oneLine("a\n\tb  c", 10), "a b c");
	assert.equal(oneLine("hello world", 8), "hello w…");
	assert.equal(oneLine(null), "");
	assert.equal(oneLine(undefined), "");
});

test("oneLine: sanitize 上限 4096，避免扫超大输入", () => {
	// 超过 4096 的前缀被截断后再折叠；结果长度仍受 max 约束
	const huge = `${"y".repeat(5000)}\nmore`;
	const out = oneLine(huge, 20);
	assert.equal(out.length, 20);
	assert.equal(out.startsWith("y"), true);
});
