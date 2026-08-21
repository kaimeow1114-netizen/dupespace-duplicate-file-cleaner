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
  void totalBytes;
  if (duplicateBytes === 0 && duplicateGroups === 0) return 98;

  let penalty = 0;
  const duplicateGB = duplicateBytes / (1024 * 1024 * 1024);

  if (duplicateGB >= 10) penalty += 65;
  else if (duplicateGB >= 5) penalty += 55;
  else if (duplicateGB >= 1) penalty += 45;
  else if (duplicateGB > 0) penalty += 35;

  if (duplicateGroups >= 50) penalty += 20;
  else if (duplicateGroups >= 10) penalty += 15;
  else if (duplicateGroups > 0) penalty += 10;

  const calculated = Math.max(18, Math.min(100, 100 - penalty));
  return Math.round(calculated);
}

export function getHealthState(score: number): HealthState {
  if (score < 40) {
    return { level: "critical", label: "空間嚴重擁擠", detail: "建議立即優化" };
  }
  if (score < 80) {
    return { level: "moderate", label: "空間存在冗餘", detail: "建議整理" };
  }
  return { level: "optimal", label: "儲存狀態極佳", detail: "安全防護中" };
}
