import { open } from "node:fs/promises";
import { extname, resolve } from "node:path";

type Cell = string | number | null;
type Metric = "clicks" | "impressions" | "ctr" | "position";
type MetricColumns = Partial<Record<Metric, string>>;
export interface GscReadOptions { offset?: number; limit?: number; rows?: number[] }
export interface GscMetricSummary { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null }
export interface GscTable {
  source: string;
  columns: string[];
  dimensions: Array<{ column: string; dimension: string | null }>;
  totalRows: number;
  rows: Array<{ row: number; values: Record<string, Cell> }>;
  nextOffset: number | null;
  scope: { kind: "table" | "selected_rows"; rowCount: number; meaning: string };
  summary: Record<string, GscMetricSummary> | null;
  metricColumns: Record<string, MetricColumns>;
  metadata: Record<string, unknown>;
  warnings: string[];
}

const MAX_BYTES = 8 * 1024 * 1024;
const METRICS: Record<Metric, string[]> = {
  clicks: ["clicks", "点击次数", "點擊次數"],
  impressions: ["impressions", "展示次数", "曝光次数", "曝光次數", "顯示次數"],
  ctr: ["ctr", "click-through rate", "点击率", "點閱率", "點擊率"],
  position: ["average position", "position", "平均排名", "排名"],
};
const DIMENSIONS: Record<string, string[]> = {
  query: ["query", "queries", "top queries", "查询", "查询次数", "热门查询", "查詢", "查詢字詞", "熱門查詢"],
  page: ["page", "pages", "top pages", "网页", "页面", "網頁", "頁面"],
  date: ["date", "dates", "日期"],
  country: ["country", "countries", "国家/地区", "国家", "國家/地區", "國家"],
  device: ["device", "devices", "设备", "裝置"],
  searchAppearance: ["search appearance", "searchappearance", "搜索结果呈现", "搜尋結果呈現方式"],
  hour: ["hour", "小时", "小時"],
};

function normalize(value: string): string { return value.trim().replace(/\s+/g, " ").toLowerCase(); }

function parseDelimited(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [], field = "", quoted = false, closed = false;
  const finishField = () => { record.push(field); field = ""; closed = false; };
  const finishRecord = () => {
    const present = record.length > 0 || field !== "" || closed;
    finishField();
    if (present) records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === delimiter) finishField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRecord();
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Malformed CSV: unexpected character around a quoted field");
      field += char;
    }
  }
  if (quoted) throw new Error("Malformed CSV: unterminated quoted field");
  if (field || record.length || closed) finishRecord();
  return records;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function parseJson(text: string): { columns: string[]; records: Cell[][]; metadata: Record<string, unknown> } {
  const root = object(JSON.parse(text), "GSC JSON");
  const request = root.request === undefined ? root : object(root.request, "request");
  const response = root.response === undefined ? root : object(root.response, "response");
  const dimensions = request.dimensions;
  if (!Array.isArray(dimensions) || dimensions.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("GSC API JSON requires explicit request.dimensions (or top-level dimensions); keys cannot be guessed");
  }
  const columns = [...dimensions as string[], "clicks", "impressions", "ctr", "position"];
  const rawRows = response.rows === undefined ? [] : response.rows;
  if (!Array.isArray(rawRows)) throw new Error("GSC API response.rows must be an array");
  const records = rawRows.map((entry, index) => {
    const row = object(entry, `API row ${index + 1}`);
    const keys = row.keys === undefined && dimensions.length === 0 ? [] : row.keys;
    if (!Array.isArray(keys) || keys.length !== dimensions.length || keys.some((key) => typeof key !== "string")) {
      throw new Error(`API row ${index + 1}: keys must match declared dimensions`);
    }
    const cells: Cell[] = [...keys as string[]];
    for (const metric of ["clicks", "impressions", "ctr", "position"]) {
      const value = row[metric];
      if (value !== undefined && value !== null && typeof value !== "number") throw new Error(`API row ${index + 1}: ${metric} must be a number`);
      cells.push(value === undefined ? null : value as number | null);
    }
    return cells;
  });
  const metadata: Record<string, unknown> = {};
  for (const key of ["siteUrl", "property"]) {
    if (root[key] !== undefined) metadata[key] = root[key];
  }
  for (const key of ["siteUrl", "property", "startDate", "endDate", "type", "searchType", "dataState", "dimensions", "dimensionFilterGroups", "aggregationType", "rowLimit", "startRow"]) {
    if (request[key] !== undefined) metadata[key] = request[key];
  }
  if (response.responseAggregationType !== undefined) metadata.responseAggregationType = response.responseAggregationType;
  if (response.metadata !== undefined) {
    const extra = object(response.metadata, "response.metadata");
    for (const key of ["first_incomplete_date", "first_incomplete_hour"]) if (extra[key] !== undefined) metadata[key] = extra[key];
  }
  return { columns, records, metadata };
}

function metricColumn(header: string): { metric: Metric; period: string } | null {
  const normalized = normalize(header);
  for (const [metric, aliases] of Object.entries(METRICS) as [Metric, string[]][]) {
    for (const alias of aliases) {
      if (normalized === alias) return { metric, period: "unspecified" };
      if (normalized.endsWith(` ${alias}`)) return { metric, period: header.trim().slice(0, -alias.length).trim() };
    }
  }
  return null;
}

function numberCell(value: Cell, metric: Metric, label: string): number | null {
  if (value === null || value === "" || (typeof value === "string" && /^(?:-|—|~|n\/a)$/i.test(value.trim()))) return null;
  let number: number;
  if (typeof value === "number") number = value;
  else {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const percent = metric === "ctr" && trimmed.endsWith("%");
    const text = percent ? trimmed.slice(0, -1) : trimmed;
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) throw new Error(`${label}: invalid ${metric} value ${JSON.stringify(value)}`);
    number = Number(text.replaceAll(",", "")) / (percent ? 100 : 1);
  }
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER || ((metric === "clicks" || metric === "impressions") && !Number.isSafeInteger(number)) || (metric === "ctr" && number > 1) || (metric === "position" && number > 0 && number < 1)) {
    throw new Error(`${label}: invalid or unsafe ${metric} value`);
  }
  return number;
}

function sumCounts(values: Array<number | null>, label: string): number | null {
  if (values.some((value) => value === null)) return null;
  const sum = (values as number[]).reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(sum)) throw new Error(`${label}: aggregate exceeds safe integer precision`);
  return sum;
}

export async function readGscTable(filePath: string, options: GscReadOptions = {}): Promise<GscTable> {
  const offset = options.offset ?? 0, limit = options.limit ?? 50;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error("offset must be nonnegative and limit must be 1–200");
  if (options.rows !== undefined && (options.offset !== undefined || !Array.isArray(options.rows) || !options.rows.length || new Set(options.rows).size !== options.rows.length)) throw new Error("rows must be a nonempty unique selection and cannot be combined with offset");
  const source = resolve(filePath), extension = extname(source).toLowerCase();
  if (extension === ".zip") throw new Error("Extract the GSC ZIP into a separate local directory, then read its CSV files individually");
  if (extension === ".xlsx" || extension === ".xls") throw new Error("Convert the workbook sheets to separate CSV files; preserve date ranges, filters and sheet names");
  if (![".csv", ".tsv", ".json"].includes(extension)) throw new Error("Supported GSC input formats: CSV, TSV and API JSON");
  const handle = await open(source, "r");
  let text: string;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("GSC input must be a regular file");
    if (stat.size > MAX_BYTES) throw new Error("GSC input exceeds the 8 MiB size limit");
    const buffer = Buffer.alloc(Math.min(stat.size + 1, MAX_BYTES + 1));
    let size = 0;
    while (size < buffer.length) {
      const read = await handle.read(buffer, size, buffer.length - size, size);
      if (!read.bytesRead) break;
      size += read.bytesRead;
    }
    if (size > MAX_BYTES || size !== stat.size) throw new Error("GSC input changed while reading or exceeds the 8 MiB size limit; retry a stable export");
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size)).replace(/^\uFEFF/, "");
  } finally { await handle.close(); }
  let columns: string[], records: Cell[][], metadata: Record<string, unknown> = {};
  if (extension === ".json") ({ columns, records, metadata } = parseJson(text));
  else {
    const parsed = parseDelimited(text, extension === ".tsv" ? "\t" : ",");
    columns = parsed.shift()?.map((value) => value.trim()) ?? [];
    records = parsed;
  }
  if (!columns.length || columns.some((value) => !value) || new Set(columns.map(normalize)).size !== columns.length) throw new Error("GSC table requires nonempty, unique column headers");
  const metricColumns: Record<string, MetricColumns> = Object.create(null);
  const dimensionColumns: string[] = [];
  for (const column of columns) {
    const info = metricColumn(column);
    if (!info) dimensionColumns.push(column);
    else {
      const group = metricColumns[info.period] ??= {};
      if (group[info.metric]) throw new Error(`Ambiguous metric columns for ${info.period}: ${info.metric}`);
      group[info.metric] = column;
    }
  }
  const dimensions = dimensionColumns.map((column) => ({ column, dimension: Object.entries(DIMENSIONS).find(([, aliases]) => aliases.includes(normalize(column)))?.[0] ?? null }));
  const allRows = records.map((record, index) => {
    if (record.length !== columns.length) throw new Error(`Row ${index + 1} has ${record.length} cells; expected ${columns.length}`);
    const values = Object.fromEntries(columns.map((column, cell) => [column, record[cell]]));
    for (const group of Object.values(metricColumns)) {
      for (const [metric, column] of Object.entries(group) as [Metric, string][]) values[column] = numberCell(values[column], metric, `Row ${index + 1}, ${column}`);
      const clicks = group.clicks ? values[group.clicks] as number | null : null;
      const impressions = group.impressions ? values[group.impressions] as number | null : null;
      if (clicks !== null && impressions !== null && clicks > impressions) {
        throw new Error(`Row ${index + 1}: clicks exceed impressions`);
      }
    }
    return { row: index + 1, values };
  });
  if (offset > allRows.length) throw new Error("offset is beyond the table");
  if (options.rows?.some((row) => !Number.isSafeInteger(row) || row < 1 || row > allRows.length)) throw new Error("rows contains an out-of-range record number");
  const selected = options.rows ? options.rows.map((row) => allRows[row - 1]) : allRows;
  const warnings = ["Totals cover this table or explicit row selection only. GSC exports can omit queries or rows; totals are not guaranteed whole-site totals. Do not join independent Queries and Pages exports."];
  if (!Object.keys(metadata).length) warnings.push("Date ranges, property, search type, filters and aggregation are unknown unless supplied in accompanying export metadata.");
  if (dimensions.some((item) => item.dimension === "page") || metadata.responseAggregationType === "byPage") warnings.push("Page-level rows may count the same search impression for multiple URLs. Their sums are not property-level query totals.");
  const unknownDimensions = dimensions.some((item) => item.dimension === null);
  if (unknownDimensions) warnings.push("Some dimension headers are unrecognized; summary is unavailable. Keep their raw labels and verify meaning before aggregation.");
  const keys = selected.map(({ values }) => JSON.stringify(dimensionColumns.map((column) => values[column])));
  const duplicates = selected.length > 1 && new Set(keys).size !== keys.length;
  let summary: Record<string, GscMetricSummary> | null = null;
  if (duplicates) warnings.push("Duplicate dimension rows make aggregation ambiguous; summary is unavailable. Inspect overlapping exports or missing dimensions.");
  else if (!unknownDimensions && selected.length && Object.keys(metricColumns).length) {
    summary = Object.create(null) as Record<string, GscMetricSummary>;
    for (const [period, group] of Object.entries(metricColumns)) {
      const values = (metric: Metric) => selected.map((row) => group[metric] ? row.values[group[metric]!] as number | null : null);
      const clicks = sumCounts(values("clicks"), "clicks"), impressions = sumCounts(values("impressions"), "impressions");
      const positions = values("position"), weights = values("impressions");
      let position: number | null = null;
      if (impressions && !weights.some((weight, i) => weight! > 0 && (positions[i] === null || positions[i] === 0))) {
        const weighted = weights.reduce<number>((sum, weight, i) => sum + (weight === 0 ? 0 : weight! * positions[i]!), 0);
        if (!Number.isFinite(weighted)) throw new Error("Weighted position exceeds numeric range");
        position = weighted / impressions;
      }
      summary[period] = { clicks, impressions, ctr: impressions && clicks !== null ? clicks / impressions : null, position };
      if (clicks === null || impressions === null || (impressions !== 0 && position === null)) warnings.push(`${period}: missing metrics remain null; no missing value is treated as zero.`);
    }
  }
  const start = options.rows ? 0 : offset;
  return {
    source, columns, dimensions, totalRows: allRows.length,
    rows: selected.slice(start, start + limit),
    nextOffset: !options.rows && offset + limit < allRows.length ? offset + limit : null,
    scope: { kind: options.rows ? "selected_rows" : "table", rowCount: selected.length, meaning: "All selected rows, including rows outside this response page; CTR is a 0–1 ratio and position is weighted by impressions." },
    summary, metricColumns, metadata, warnings,
  };
}
