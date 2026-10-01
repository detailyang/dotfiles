export type CumulativeSeriesBuckets = {
  cumInput: number[];
  cumCacheRead: number[];
  cumCacheWrite: number[];
  cumHitPercent: number[];
};

export function bucketItems<T>(items: T[], bucketCount: number): T[][] {
  if (items.length <= bucketCount) {
    return items.map((item) => [item]);
  }

  const buckets: T[][] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    const start = Math.floor((i * items.length) / bucketCount);
    const end = Math.floor(((i + 1) * items.length) / bucketCount);
    buckets.push(items.slice(start, Math.max(start + 1, end)));
  }
  return buckets;
}

/**
 * Buckets a flat numeric array using max. This preserves the visible endpoint
 * for monotonic cumulative series, where max == last sample in each bucket.
 */
export function bucketMaxValues(values: number[], bucketCount: number): number[] {
  if (values.length <= bucketCount) return [...values];

  const result: number[] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    const start = Math.floor((i * values.length) / bucketCount);
    const end = Math.floor(((i + 1) * values.length) / bucketCount);
    const slice = values.slice(start, Math.max(start + 1, end));
    result.push(Math.max(...slice));
  }
  return result;
}

export function bucketCumulativeSeries(
  series: CumulativeSeriesBuckets,
  bucketCount: number,
): CumulativeSeriesBuckets {
  return {
    cumInput: bucketMaxValues(series.cumInput, bucketCount),
    cumCacheRead: bucketMaxValues(series.cumCacheRead, bucketCount),
    cumCacheWrite: bucketMaxValues(series.cumCacheWrite, bucketCount),
    cumHitPercent: bucketMaxValues(series.cumHitPercent, bucketCount),
  };
}
