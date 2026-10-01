import assert from "node:assert/strict";
import test from "node:test";
import { ReviewDashboard } from "../extensions/review/parallel.ts";

test("closing the review dashboard waits for cancelled runs to finish cleanup", async () => {
  let release!: () => void;
  let signal: AbortSignal | undefined;
  let closed = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const dashboard = new ReviewDashboard(["offline"], async (_model, _prompt, _options, _onEvent, received) => {
    signal = received;
    await gate;
    throw new Error("Aborted");
  });
  dashboard.setHandle({ requestRender() {}, close() { closed = true; } });
  const run = dashboard.run("fixture");
  dashboard.handleInput("\x1b");
  assert.equal(signal?.aborted, true);
  assert.equal(closed, false);
  assert.match(dashboard.render(100).join("\n"), /Cancelling reviews/);
  assert.doesNotMatch(dashboard.render(100).join("\n"), /All reviews complete/);
  release();
  await run;
  assert.equal(closed, true);
  assert.deepEqual(dashboard.getResults(), [{ model: "offline", text: "", error: true }]);
  assert.match(dashboard.render(100).join("\n"), /Reviews cancelled/);
});

test("review dashboard distinguishes failed, partial and successful runs", async () => {
  for (const failures of [0, 1, 2]) {
    const dashboard = new ReviewDashboard(["first", "second"], async (model) => {
      if (failures === 2 || (failures === 1 && model === "first")) throw new Error("offline failure");
    });
    await dashboard.run("fixture");
    const expected = failures === 0 ? /All reviews complete/ : failures === 1 ? /Reviews finished with errors/ : /All reviews failed/;
    assert.match(dashboard.render(100).join("\n"), expected);
    assert.equal(dashboard.getResults().filter((result) => result.error).length, failures);
  }
});
