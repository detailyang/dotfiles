---
name: hn
description: Fetch and summarize the top 10 HackerNews stories. Use when the user types /hn or asks for HackerNews hot stories / trending topics. Runs fetch_hn.py to get live data, then summarizes each story in one sentence.
---

# HackerNews Top 10

## Workflow

1. Run the fetch script:
   ```bash
   python3 scripts/fetch_hn.py
   ```

2. For each story in the JSON output, fetch the article content using WebFetch on the `url` field.

3. Output a numbered list in this format:
   ```
   1. **[Title](url)** — one-sentence summary. (score: N, comments: N)
   ```

4. Keep each summary to one sentence, factual and concise. If the URL is a PDF or unreachable, summarize from the title alone.
