type MetricGroup = { records: { id: string; size: number; keeper: boolean }[] };

export function storageMetrics(groups: MetricGroup[], examinedBytes: number, quotaBytes: number) {
  const seen = new Set<string>();
  let duplicateBytes = 0;
  for (const group of groups) for (const record of group.records) {
    if (record.keeper || seen.has(record.id)) continue;
    seen.add(record.id);
    duplicateBytes += Number.isFinite(record.size) ? Math.max(0, record.size) : 0;
  }
  const ratio = (total: number) => Number.isFinite(total) && total > 0
    ? Math.min(100, duplicateBytes / total * 100) : null;
  return { duplicateBytes, duplicateCount: seen.size, duplicatePercent: ratio(examinedBytes), quotaPercent: ratio(quotaBytes) };
}

export function capacityEquivalent(bytes: number, monthlyPrice: number, capacityGb: number) {
  if (![bytes, monthlyPrice, capacityGb].every(Number.isFinite) || capacityGb <= 0) return 0;
  return Math.max(0, bytes) / (capacityGb * 1024 ** 3) * Math.max(0, monthlyPrice);
}
