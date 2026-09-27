# Loop

`/loop tests`, `/loop custom <condition>`, or `/loop self` starts automatic
follow-up runs. In TUI mode, `/loop` opens the preset selector.

## Stop Outcomes

- `signal_loop_success` stops the loop only when its completion condition is
  actually satisfied. A final response alone is not a success signal.
- `signal_loop_blocked` stops automatic follow-ups **without claiming success**.
  Its required `reason` records the evidence gathered, attempted paths, remaining
  blocker, and next input or action needed. Finish actionable work first, then
  hand off rather than repeating an unanswered question or an unavailable action.
- `/loop stop` cancels an active loop operation and clears the loop widget. It
  does not signal success or abort unrelated work for an already inactive loop.

Blocked loops retain their original condition, iteration count, and reason on
the current session branch. The widget displays the blocker, including after
reload or `/tree` navigation. Later messages do not automatically restart the
loop; the user must explicitly start it again with `/loop <mode>`.

For example, if code and tests are delivered but a required MR review thread
needs a signed-in user to click **Resolved**, report a blocked handoff. Do not
call `signal_loop_success`, silently replace the gate with “code delivered,” or
keep requesting the same confirmation. Stopping automation and satisfying the
completion condition are separate outcomes.

## Lifecycle

Stopping invalidates a pending continuation. Pi owns model retries; exhausted
retries and cancellation stop the loop. Reload stops an active loop while
preserving an already blocked handoff. Continuation and compaction prompts both
include the blocked-exit instructions; old stored active prompts are rebuilt
from their original mode and condition when restored.

Already-running extension instances need `/reload` to load code changes and
register the blocked tool. Use `/loop stop` to stop an existing runaway loop.

## Verification

From the repository root:

```sh
node --test pi/tests/loop-*.test.ts
make check-pi
```

The Agent queue regression uses offline responses and makes no model-provider
requests or MR changes.
