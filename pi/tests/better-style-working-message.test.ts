import assert from "node:assert/strict";
import test from "node:test";
import workingMessageExtension from "../extensions/better-style/feature/shell/working-message.ts";

function install() {
	const events = new Map<string, Function>();
	const messages: (string | undefined)[] = [];
	const ui = {
		setWorkingMessage(message?: string) {
			messages.push(message);
		},
	} as any;
	workingMessageExtension({
		on(name: string, handler: Function) {
			events.set(name, handler);
		},
	} as any);
	const ctx = { hasUI: true, ui };
	return { events, messages, ctx };
}

test("working message appends token count and elapsed time while streaming", async () => {
	const { events, messages, ctx } = install();

	await events.get("turn_start")?.({}, ctx);
	// No tokens yet and under the timer threshold: keep Pi's default "Working...".
	assert.equal(messages.at(-1), undefined);

	const delta = "This is a streaming response body long enough to count some tokens.";
	await events.get("message_update")?.(
		{ assistantMessageEvent: { type: "text_start", contentIndex: 0 } },
		ctx,
	);
	await events.get("message_update")?.(
		{ assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta } },
		ctx,
	);
	const working = messages.at(-1);
	assert.match(working ?? "", /^Working\.\.\. \(↓ \d+ tokens · \d+s\)$/);

	await events.get("turn_end")?.({}, ctx);
	assert.equal(messages.at(-1), undefined, "turn end restores default without a completion line");
	assert.equal(
		messages.some((message) => message?.startsWith("✻ Turn took")),
		false,
	);

	// Shutdown remains idempotent (undefined = Pi's default message).
	await events.get("session_shutdown")?.({}, ctx);
	assert.equal(messages.at(-1), undefined);
});

test("token count accumulates across deltas and resets on the next turn", async () => {
	const { events, messages, ctx } = install();
	await events.get("turn_start")?.({}, ctx);

	await events.get("message_update")?.(
		{ assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "abcd" } },
		ctx,
	);
	const first = messages.at(-1) ?? "";
	assert.match(first, /↓ 1 tokens/);

	await events.get("message_update")?.(
		{ assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "abcd" } },
		ctx,
	);
	assert.match(messages.at(-1) ?? "", /↓ 2 tokens/);

	// text_end provides the full block; it must replace, not double-count, deltas.
	await events.get("message_update")?.(
		{
			assistantMessageEvent: {
				type: "text_end",
				contentIndex: 0,
				content: "abcdefgh",
				partial: {},
			},
		},
		ctx,
	);
	assert.match(messages.at(-1) ?? "", /↓ 2 tokens/);

	// A second text block accumulates independently by contentIndex.
	await events.get("message_update")?.(
		{ assistantMessageEvent: { type: "text_start", contentIndex: 1, partial: {} } },
		ctx,
	);
	await events.get("message_update")?.(
		{
			assistantMessageEvent: {
				type: "text_delta",
				contentIndex: 1,
				delta: "abcdefgh",
				partial: {},
			},
		},
		ctx,
	);
	assert.match(messages.at(-1) ?? "", /↓ 4 tokens/);

	// Provider usage replaces the live chars/4 estimate when available.
	await events.get("message_update")?.(
		{
			assistantMessageEvent: {
				type: "done",
				message: {
					content: [
						{ type: "text", text: "abcdefgh" },
						{ type: "text", text: "abcdefgh" },
					],
					usage: { output: 37 },
				},
			},
		},
		ctx,
	);
	assert.match(messages.at(-1) ?? "", /↓ 37 tokens/);

	// A new turn resets both estimated and provider counts.
	await events.get("turn_end")?.({}, ctx);
	await events.get("turn_start")?.({}, ctx);
	assert.equal(messages.at(-1), undefined);
});
