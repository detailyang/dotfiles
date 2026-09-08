# Goal Runtime

`/goal [--tokens 50k] <objective>` sets a goal. The model can also call
`create_goal`, but only on an explicit user request. Goals are isolated per
extension instance and restored from the current session branch, including
`/tree` navigation. Reload pauses an active goal.

## Stopping and Resuming

- `/goal pause` and `/goal clear` stop an operation pursuing that goal, without
  aborting unrelated work for an already inactive goal. Cancellation pauses an
  active goal without scheduling another run.
- Model errors do not schedule goal continuations. Pi owns automatic retries;
  if retries finish without success, the goal pauses with the failure reason.
- `update_goal` accepts `complete` after an evidence-based completion audit, or
  `blocked` with a reason describing evidence, attempts, the blocker, and the
  next input needed. Blocked goals do not automatically continue.
- `/goal resume` resumes a paused or blocked goal with budget remaining, or
  starts an idle active goal restored from a session. It cannot reopen a completed
  goal or replenish an exhausted budget. Continuing
  beyond that budget requires an explicitly created replacement goal.
- `/goal status` shows the objective, status, and stop reason. Status-bar settings
  are saved alongside the goal on the current branch.

## Budget Boundary

Usage is the main assistant's reported total tokens, including cache reads and
writes. Missing totals are reconstructed from the reported components. It does
not include separate compaction calls or child-agent usage.

The full assistant turn that creates or replaces a goal is charged to the new
objective. Subsequent turns in that run, including completion and blocked/budget
wrap-up turns, are also charged. Unrelated prompts after the run settles are not
charged to an inactive goal. Clearing a goal discards its counters.

The budget is checked at `turn_end`, after the response and its tool batch finish.
It is not a provider-level hard token cap: the crossing turn can overshoot. At
that boundary the model is notified via steering, before the next response. Only
`get_goal` and `update_goal` may execute during at most two additional wrap-up
turns. This allows marking a verified completion and producing a final summary
without new work. An agent still issuing tool calls at the end of that allowance
is aborted. Wrap-up tokens remain visible in the saved usage.

## Verification

From the repository root:

```sh
node --test pi/tests/goal-*.test.ts
make check-pi
```

The runtime tests use Pi's real Agent queues with offline responses; they do not
contact a model provider or execute host work tools.
