# retry

This extension lets Pi's native automatic retry policy recover from transient
Basis Points responses that `pi-ai` does not classify as retryable by default:

- `basispoints_protocol_error`
- `basispoints_upstream_error`
- `basispoints_stream_incomplete`
- `server_is_overloaded`

It also retries these plain-text transport failures, which carry no error code:

- `Error: Upstream HTTP/2 stream failed`
- `Error: Connection error.`

The extension only reclassifies assistant errors containing those exact error
codes or messages, including the Excel/BPS forms:

- `basispoints_protocol_error: basispoints returned a tool outside the client's catalog`
- `Excel BPS upstream failure: basispoints_upstream_error; request was not replayed`
- `Retry failed after 3 attempts: Excel BPS upstream failure: basispoints_upstream_error; request was not replayed`

It does not retry arbitrary `404` responses or resend user messages.

To add another known-transient error code, edit `DEFAULT_RETRY_ERROR_CODES` in
`index.ts`; for a code-less message, edit `DEFAULT_RETRY_ERROR_MESSAGE_PATTERNS`. Pi's retry settings control whether and how often the request is retried.
The recommended defaults for this extension are:

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 10,
    "baseDelayMs": 10000,
    "maxAgentDelayMs": 60000
  }
}
```

These values mean up to 10 retries, starting at 10 seconds and capping each
backoff at 60 seconds.
