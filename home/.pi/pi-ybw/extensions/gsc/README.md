# GSC

Analyze Google Search Console exports with the current Pi model.
The extension adds `/gsc` and the read-only `gsc_read` tool.
Run `/gsc` inside an interactive Pi session or RPC. Single-shot
`pi -p '/gsc ...'` and JSON mode are rejected; `gsc_read` remains available
to ordinary model turns in those modes.

## Use

```text
/gsc
```

The command asks one question at a time: website, current GSC export, optional
comparison export, audience, business goal and brand names. Press Enter to skip
an optional question or Esc to cancel. Invalid websites and paths are retried at
the same question without losing earlier answers. Answers are sent once after
the last question.

`/gsc https://jundapipe.com` skips the website question. Input fields accept
spaces without quotes; separate brand aliases with commas. `/gsc --help` shows help.
Paths resolve against the current working directory; `~/` is supported.
The command checks explicit paths and does not modify the exports.

Optional arguments can prefill answers: `--data <path>`, `--compare <path>`,
`--audience "<audience>"`, `--goal "<goal>"` and `--brand "<brand>"`.
The wizard only asks for missing fields. Repeat `--data`, `--compare` or `--brand`
for multiple values; quote argument values containing spaces. RPC clients without
UI dialogs must supply the website as an argument; remaining context stays unknown.

The report contains a data-quality audit, up to 15 ranked intent clusters, five
detailed actions, the first task to do, a 30-day order and lower-priority ideas.
Every cluster has one primary action. Insufficient evidence produces fewer
opportunities. The report is in Chinese; suggested titles keep the site's language.

If no path is supplied, Pi can use GSC evidence already available in the session.
A website URL alone cannot supply private GSC metrics. Without valid data, the
workflow asks for an export instead of inventing traffic numbers. Audience and
conversion goal can come from explicit session context; any inference is labeled.

## Data

Export the Search results performance report from GSC with Queries, Pages,
Filters and Dates when available. For a comparison, use complete periods with
matching duration and filters. Keep original filter/date metadata with each
export. Missing dates remain unknown.

`gsc_read` reads one UTF-8 CSV/TSV table or Search Analytics JSON file at a time.
English and common Chinese metric headers are supported. Plain CSV exports and
recognized prefixed comparison columns can be aggregated. ZIP files must first
be safely extracted, and XLSX files converted with an available reader or exported
as CSV. The analysis workflow can use Pi's existing tools for those steps; the
data tool itself does not unpack archives or parse spreadsheets.

Search Analytics responses must include the request's dimension order. Example
with **illustrative** metrics:

```json
{
  "request": {
    "siteUrl": "https://example.com/",
    "startDate": "2026-09-01",
    "endDate": "2026-09-28",
    "type": "web",
    "dimensions": ["query", "page"],
    "aggregationType": "byPage"
  },
  "response": {
    "responseAggregationType": "byPage",
    "rows": [{
      "keys": ["pipe repair", "https://example.com/pipe-repair/"],
      "clicks": 11,
      "impressions": 1000,
      "ctr": 0.011,
      "position": 14
    }]
  }
}
```

A top-level `dimensions` plus `rows` is also supported. A bare API response with
`keys` cannot reveal which dimensions were requested. Retain request filters and
pagination/completeness information; even a paginated API export can omit rows.

Separate Queries and Pages tables do not establish query-to-page mappings.
A matching URL is reported only when explicit joint rows or verified page-filter
metadata support it. Otherwise the mapping is unavailable.

## Calculations and limits

`gsc_read({path, offset?, limit?, rows?})` returns source records, metadata,
warnings and a table summary. `rows` selects 1-based data record numbers for a
cluster; it does not refer to physical text lines. Use it instead of `offset`.
The default page size is 50, with a maximum of 200 returned records. Summaries
cover the complete table or the complete row selection, not just the visible
page. Follow pagination to inspect the remaining source records.

- CTR = total clicks / total impressions, returned as a fraction.
- Average position = sum(impressions × position) / total impressions.
- Missing values stay unknown. Zero impressions give undefined CTR and position.
  An exported position of zero with impressions is treated as unavailable.
- Duplicate or unrecognized dimension records prevent an unqualified aggregate.
- Each summary belongs to its source table. Page-level sums are not property totals.
- Each input file is limited to 8 MiB. Unsupported or malformed data fails explicitly.

The model decides intent, relevance and priority. It must verify page content
before presenting gaps as facts, compare CTR within relevant position/brand
contexts, and distinguish observations from hypotheses. The extension does not
establish Google OAuth or promise rankings, revenue or traffic growth.

## Development

This directory is discovered by the existing Pi package; no manifest change is
needed. From the repository root, load just this extension for a temporary session:

```bash
pi -e ./home/.pi/pi-ybw/extensions/gsc/index.ts
```

After updating an installed local package, use Pi's `/reload`.
Run `make check-pi` for types, inventory and tests.

References: [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[Search performance report](https://support.google.com/webmasters/answer/7576553),
[Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).
