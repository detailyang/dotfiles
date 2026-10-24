import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readGscTable } from "../extensions/gsc/data.ts";

async function fixture(t: any, text: string, name = "Queries.csv") {
  const root = await mkdtemp(join(tmpdir(), "pi-gsc-data-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, name);
  await writeFile(file, text);
  return file;
}

test("GSC totals use summed counts and impression-weighted position, independent of pagination", async (t) => {
  const file = await fixture(t, "Top queries,Clicks,Impressions,CTR,Position\na,10,100,10%,5\nb,1,900,0.11%,15\n");
  const data = await readGscTable(file, { limit: 1 });
  assert.equal(data.totalRows, 2);
  assert.equal(data.rows.length, 1);
  assert.equal(data.nextOffset, 1);
  assert.deepEqual(data.summary?.unspecified, { clicks: 11, impressions: 1000, ctr: 0.011, position: 14 });
  assert.equal(data.scope.kind, "table");
  assert.equal(data.dimensions[0].dimension, "query");
});

test("selected row numbers aggregate the whole selection and reject invalid selections", async (t) => {
  const file = await fixture(t, "Query,Clicks,Impressions,Position\na,1,10,2\nb,9,90,12\n");
  const data = await readGscTable(file, { rows: [2, 1], limit: 1 });
  assert.equal(data.rows[0].row, 2);
  assert.equal(data.scope.rowCount, 2);
  assert.equal(data.summary?.unspecified.position, 11);
  for (const options of [{ rows: [1, 1] }, { rows: [0] }, { rows: [3] }, { rows: [] }, { rows: [1], offset: 0 }, { offset: -1 }, { limit: 201 }]) {
    await assert.rejects(readGscTable(file, options));
  }
});

test("CSV handles BOM, CRLF, commas, escaped quotes, newlines and thousand separators", async (t) => {
  const file = await fixture(t, '\ufeffTop queries,Clicks,Impressions,CTR,Position\r\n"pipe, \"\"steel\"\"\nprice",10,"1,000",1%,4.5\r\n');
  const data = await readGscTable(file);
  assert.equal(data.rows[0].values["Top queries"], 'pipe, "steel"\nprice');
  assert.equal(data.summary?.unspecified.impressions, 1000);
});

test("missing or zero-impression metrics stay unknown instead of becoming zero", async (t) => {
  const file = await fixture(t, "Query,Clicks,Impressions,Position\na,1,10,2\nb,,90,\n");
  const data = await readGscTable(file);
  assert.deepEqual(data.summary?.unspecified, { clicks: null, impressions: 100, ctr: null, position: null });
  assert.ok(data.warnings.some((warning) => /missing/i.test(warning)));
  const zero = await fixture(t, "Query,Clicks,Impressions,Position\na,0,0,0\n", "zero.csv");
  assert.deepEqual((await readGscTable(zero)).summary?.unspecified, { clicks: 0, impressions: 0, ctr: null, position: null });
});

test("duplicate dimension rows prevent ambiguous totals", async (t) => {
  const file = await fixture(t, "Query,Clicks,Impressions,Position\na,1,10,2\na,9,90,12\n");
  const data = await readGscTable(file);
  assert.equal(data.summary, null);
  assert.ok(data.warnings.some((warning) => /duplicate/i.test(warning)));
});

test("comparison metrics stay separate and Chinese TSV headers are recognized", async (t) => {
  const file = await fixture(t, "Query,Last 28 days Clicks,Last 28 days Impressions,Last 28 days Position,Previous 28 days Clicks,Previous 28 days Impressions,Previous 28 days Position\na,2,20,4,1,10,5\n");
  const data = await readGscTable(file);
  assert.equal(data.summary?.["Last 28 days"].clicks, 2);
  assert.equal(data.summary?.["Previous 28 days"].position, 5);
  const zh = await fixture(t, "查询次数\t点击次数\t展示次数\t平均排名\na\t2\t20\t4\n", "zh.tsv");
  assert.equal((await readGscTable(zh)).summary?.unspecified.ctr, 0.1);
});

test("metadata tables are readable but do not manufacture metrics or dates", async (t) => {
  const file = await fixture(t, "Filter,Value\nSearch type,Web\nDate,Last 28 days\n", "Filters.csv");
  const data = await readGscTable(file);
  assert.equal(data.summary, null);
  assert.equal(data.rows[1].values.Value, "Last 28 days");
});

test("blank data records are retained and unknown grouping columns disable aggregation", async (t) => {
  const blank = await fixture(t, "Query,Clicks,Impressions,Position\na,1,10,2\n,,,\n\n");
  const data = await readGscTable(blank);
  assert.equal(data.totalRows, 2);
  assert.equal(data.summary?.unspecified.clicks, null);
  const unknown = await fixture(t, "Query,Note,Clicks,Impressions,Position\na,one,1,10,2\na,two,1,10,2\n", "unknown.csv");
  assert.equal((await readGscTable(unknown)).summary, null);
});

test("impossible counts are rejected and zero exported positions remain unknown", async (t) => {
  for (const row of ["a,11,10,2", "a,1,0,0", "a,1,10,0.5"]) {
    const file = await fixture(t, `Query,Clicks,Impressions,Position\n${row}\n`);
    await assert.rejects(readGscTable(file), /clicks|position/i);
  }
  const missing = await fixture(t, "Query,Clicks,Impressions,Position\na,1,10,0\n");
  assert.equal((await readGscTable(missing)).summary?.unspecified.position, null);
});

test("API property path metadata survives a separate request envelope", async (t) => {
  const file = await fixture(t, JSON.stringify({
    siteUrl: "sc-domain:example.com", request: { dimensions: [] },
    response: { rows: [{ clicks: 1, impressions: 10, position: 2 }] },
  }), "property.json");
  assert.equal((await readGscTable(file)).metadata.siteUrl, "sc-domain:example.com");
});

test("API JSON requires declared dimensions and preserves comparison metadata", async (t) => {
  const input = { request: { dimensions: ["query", "page"], startDate: "2026-09-01", endDate: "2026-09-28", type: "web", dimensionFilterGroups: [] }, response: { rows: [{ keys: ["steel", "https://example.com/steel"], clicks: 2, impressions: 20, ctr: 0.1, position: 4 }], responseAggregationType: "byPage" } };
  const file = await fixture(t, JSON.stringify(input), "api.json");
  const data = await readGscTable(file);
  assert.deepEqual(data.dimensions.map((item) => item.dimension), ["query", "page"]);
  assert.equal(data.metadata.startDate, "2026-09-01");
  assert.equal(data.metadata.responseAggregationType, "byPage");
  assert.equal(data.rows[0].values.page, "https://example.com/steel");
  const invalid = await fixture(t, JSON.stringify({ rows: input.response.rows }), "missing.json");
  await assert.rejects(readGscTable(invalid), /dimensions/);
});

test("API exports omit credential wrapper fields and support explicitly declared totals", async (t) => {
  const input = { request: { dimensions: [], startDate: "2026-09-01", access_token: "SECRET", headers: { Authorization: "SECRET" } }, response: { rows: [{ clicks: 2, impressions: 20, ctr: 0.1, position: 4 }], access_token: "SECRET", metadata: { first_incomplete_date: "2026-09-28", token: "SECRET" } } };
  const file = await fixture(t, JSON.stringify(input), "totals.json");
  const data = await readGscTable(file);
  assert.equal(data.summary?.unspecified.clicks, 2);
  assert.equal(data.metadata.first_incomplete_date, "2026-09-28");
  assert.doesNotMatch(JSON.stringify(data), /SECRET|access_token|Authorization/);
});

test("input byte limits reject oversized exports", async (t) => {
  const file = await fixture(t, "x".repeat(8 * 1024 * 1024 + 1));
  await assert.rejects(readGscTable(file), /8 MiB/);
});

test("malformed CSV, invalid metrics and unsupported archives fail clearly", async (t) => {
  for (const [index, text] of [
    'Query,Clicks,Impressions,Position\n"unclosed,1,10,2',
    'Query,Clicks,Impressions,Position\n"a"x,1,10,2',
    "Query,Clicks,Impressions,Position\na,-1,10,2",
    "Query,Clicks,Impressions,Position\na,1,NaN,2",
    "Query,Clicks,Impressions,Position\na,9007199254740992,10,2",
    "Query,Clicks,Impressions,Position\na,1,10",
    "Query,Clicks,Clicks\na,1,2",
  ].entries()) {
    const file = await fixture(t, text, `invalid-${index}.csv`);
    await assert.rejects(readGscTable(file));
  }
  const zip = await fixture(t, "not a zip", "export.zip");
  await assert.rejects(readGscTable(zip), /extract|unzip/i);
});
