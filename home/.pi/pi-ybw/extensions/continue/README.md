# continue

Send the literal user message `continue` now or after a delay. This is useful when
an account's usage window needs time to reset. Scheduling and waiting make no
model requests. The extension uses Pi's `sendUserMessage` API; it adds a new user
message rather than replaying the previous provider request.

| Command | Behavior |
| --- | --- |
| `/continue` | Send `continue` immediately. |
| `/continue 2` | Send `continue` after two hours. |
| `/continue 1.5h` | Send `continue` after 90 minutes. |
| `/continue 90m` | Send `continue` after 90 minutes. |
| `/continue status` | Show the scheduled local date and time. |
| `/continue cancel` | Cancel the timer. |

A bare number means hours. Decimal values are accepted. Delays must be positive,
at least one millisecond, and no more than 596 hours to stay within Node's timer
limit. Invalid input leaves an existing timer unchanged.

The session must be idle with no queued messages. Each session has at most one
timer. A new delay replaces the existing timer; `/continue` clears it and sends
immediately. The footer shows the scheduled time.

Keep the Pi process running. Timers are held in memory and cleared on exit,
reload, or session replacement. Starting another agent run, attempting to switch
sessions or branches, forking, or compacting also cancels the timer. At the
deadline, a busy session, queued input, or changed session history cancels the
send. The extension never interrupts active work or delivers into another
session. Timers may run late while the computer is asleep or the process is
suspended.

Each timer sends once. The extension does not check whether quota has reset or
schedule repeated attempts. Pi's existing automatic retry policy still applies
to the resulting request.
