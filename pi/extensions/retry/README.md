# retry

This extension lets Pi's native automatic retry policy recover from transient
Basis Points responses that `pi-ai` does not classify as retryable by default:

- `basispoints_protocol_error`
- `basispoints_upstream_error`
- `server_is_overloaded`

The extension only reclassifies assistant errors containing those exact error
codes. It does not retry arbitrary `404` responses or resend user messages.

To add another known-transient error code, edit `DEFAULT_RETRY_ERROR_CODES` in
`index.ts`. Pi's retry settings control whether and how often the request is retried.
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
