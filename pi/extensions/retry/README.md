# retry

This extension lets Pi's native automatic retry policy recover from transient
Basis Points responses that `pi-ai` does not classify as retryable by default:

- `basispoints_protocol_error`
- `basispoints_upstream_error`

The extension only reclassifies assistant errors containing those exact error
codes. It does not retry arbitrary `404` responses or resend user messages.

To add another known-transient error code, edit `DEFAULT_RETRY_ERROR_CODES` in
`index.ts`. Pi's normal retry settings still control whether and how often the
request is retried (`retry.enabled`, `retry.maxRetries`, and
`retry.baseDelayMs`).
