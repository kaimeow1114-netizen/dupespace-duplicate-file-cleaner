export type HealthLevel = "critical" | "moderate" | "optimal";

export type HealthState = {
  level: HealthLevel;
  label: string;
  detail: string;
};

export function calculateHealthScore(
  totalBytes: number,
  duplicateBytes: number,
  duplicateGroups: number,
): number {
  // Continuous clutter bands; neither disk health nor permission to delete a copy.
  void totalBytes;
  void duplicateGroups;
  const bytes = Number.isFinite(duplicateBytes) ? Math.max(0, duplicateBytes) : 0;
  const mib = 1024 ** 2;
  const bands = [[0, 100], [mib, 95], [10 * mib, 85], [100 * mib, 70], [500 * mib, 50], [2048 * mib, 30], [4096 * mib, 20]];
  for (let index = 1; index < bands.length; index++) {
    const [end, low] = bands[index];
    const [start, high] = bands[index - 1];
    if (bytes <= end) return Math.round(high + (low - high) * (bytes - start) / (end - start));
  }
  return Math.round(Math.max(5, 20 * (4096 * mib) / bytes));
}

export function getHealthState(score: number): HealthState {
  if (score < 40) {
    return { level: "critical", label: "有較多重複容量可整理", detail: "可先檢查較大的副本" };
  }
  if (score < 80) {
    return { level: "moderate", label: "有一些空間可整理", detail: "依實際用途決定是否保留" };
  }
  return { level: "optimal", label: "空間整理狀態良好", detail: "少量副本不必急著刪除" };
}
