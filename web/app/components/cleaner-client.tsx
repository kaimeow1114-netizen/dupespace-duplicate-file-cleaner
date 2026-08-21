"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  Eye,
  File,
  Folder,
  FolderTree,
  LoaderCircle,
  LogIn,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Square,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateHealthScore, getHealthState } from "../../lib/health-score";

type OperationMode = "trash" | "permanent";
type DriveRecord = {
  id: string;
  name: string;
  size: number;
  checksum: string;
  version: string;
  mimeType: string;
  itemKind: "file" | "folder";
  entryCount: number;
  ignoredMetadataCount: number;
  systemMetadataIgnored: boolean;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
  path: string;
  canTrash: boolean;
  canDelete: boolean;
  autoSelectable: boolean;
  keeper: boolean;
  proof: string;
};
type FolderTreeEntry = { relativePath: string; size: number; checksum: string };
type DriveGroup = {
  itemKind: "file" | "folder";
  fingerprint: string;
  reclaimableBytes: number;
  tree: FolderTreeEntry[];
  records: DriveRecord[];
};
type ScanResult = {
  examined: number;
  skipped: number;
  projectProtected: number;
  duplicateCopies: number;
  reclaimableBytes: number;
  groups: DriveGroup[];
  storageQuota: { limit?: string; usage?: string } | null;
  user: { displayName?: string; emailAddress?: string; photoLink?: string } | null;
  ignoreSystemMetadata: boolean;
};
type AuditOutcome = {
  timestamp: string;
  id: string;
  name: string;
  path: string;
  size: number;
  checksum: string;
  operationMode: OperationMode | "restore";
  status: string;
  reason: string;
  itemKind: "file" | "folder";
};
type Confirmation = {
  mode: OperationMode;
  records: DriveRecord[];
  stage: 1 | 2;
};
type UndoBatch = { items: DriveRecord[]; expiresAt: number };
type HealthHistory = { timestamp: string; score: number; reclaimedBytes: number };

const GIB = 1024 ** 3;
const MUTATION_BATCH_SIZE = 10;
const OPERATION_TIMEOUT_MS = 45_000;
const DEFAULT_SOUND_VOLUME = .22;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(value: unknown, fallback: string): string {
  return isObject(value) && typeof value.error === "string" ? value.error : fallback;
}

function isDriveRecord(value: unknown): value is DriveRecord {
  return isObject(value) && typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.size === "number" && typeof value.checksum === "string" &&
    typeof value.path === "string" &&
    (value.itemKind === "file" || value.itemKind === "folder") &&
    typeof value.entryCount === "number" &&
    typeof value.canTrash === "boolean" && typeof value.canDelete === "boolean" &&
    typeof value.autoSelectable === "boolean" && typeof value.keeper === "boolean" &&
    typeof value.proof === "string";
}

function isDriveGroup(value: unknown): value is DriveGroup {
  return isObject(value) && typeof value.fingerprint === "string" &&
    (value.itemKind === "file" || value.itemKind === "folder") && Array.isArray(value.tree) &&
    typeof value.reclaimableBytes === "number" && Array.isArray(value.records) &&
    value.records.every(isDriveRecord);
}

function isScanResult(value: unknown): value is ScanResult {
  return isObject(value) && typeof value.examined === "number" &&
    typeof value.skipped === "number" && typeof value.projectProtected === "number" &&
    typeof value.duplicateCopies === "number" &&
    typeof value.reclaimableBytes === "number" && Array.isArray(value.groups) &&
    value.groups.every(isDriveGroup);
}

function isAuditOutcome(value: unknown): value is AuditOutcome {
  return isObject(value) && typeof value.timestamp === "string" && typeof value.id === "string" &&
    typeof value.name === "string" && typeof value.size === "number" &&
    typeof value.path === "string" &&
    (value.itemKind === "file" || value.itemKind === "folder") &&
    typeof value.checksum === "string" && typeof value.operationMode === "string" &&
    typeof value.status === "string" && typeof value.reason === "string";
}

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${amount.toFixed(index === 0 ? 0 : amount >= 10 ? 1 : 2)} ${units[index]}`;
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.min(100, value / total * 100) : 0;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function removeSuccessfulRecords(scan: ScanResult, successfulIds: Set<string>): ScanResult {
  const groups = scan.groups
    .map((group) => {
      const records = group.records.filter((record) => !successfulIds.has(record.id));
      return {
        ...group,
        records,
        reclaimableBytes: records.filter((record) => !record.keeper).reduce((sum, record) => sum + record.size, 0),
      };
    })
    .filter((group) => group.records.length > 1 && group.records.some((record) => record.keeper));
  return {
    ...scan,
    groups,
    duplicateCopies: groups.reduce((total, group) => total + group.records.filter((record) => !record.keeper).length, 0),
    reclaimableBytes: groups.reduce((total, group) => total + group.reclaimableBytes, 0),
  };
}

function synthSound(kind: "confirm" | "trash" | "warning" | "deleted" | "success" | "error", volume: number): void {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const tones: Record<typeof kind, Array<[number, number, number, OscillatorType]>> = {
    confirm: [[494, 0, .08, "sine"], [659, .11, .09, "sine"]],
    trash: [[760, 0, .05, "triangle"], [980, .07, .07, "sine"]],
    warning: [[196, 0, .12, "sine"], [174, .17, .12, "sine"]],
    deleted: [[330, 0, .06, "triangle"], [247, .08, .08, "triangle"]],
    success: [[523, 0, .06, "sine"], [659, .07, .06, "sine"], [880, .14, .11, "sine"]],
    error: [[164, 0, .14, "sine"]],
  };
  for (const [frequency, offset, duration, type] of tones[kind]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(Math.max(.005, volume * .12), now + offset + .012);
    gain.gain.exponentialRampToValueAtTime(.001, now + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + duration + .02);
  }
  window.setTimeout(() => void context.close(), 700);
}

export function CleanerClient() {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [checking, setChecking] = useState(true);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [mode, setMode] = useState<OperationMode>("trash");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("連接 Google Drive 後即可開始安全掃描");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [actualBytes, setActualBytes] = useState(0);
  const [visibleGroups, setVisibleGroups] = useState(24);
  const [recordLimits, setRecordLimits] = useState<Record<string, number>>({});
  const [audit, setAudit] = useState<AuditOutcome[]>([]);
  const [account, setAccount] = useState<ScanResult["user"]>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [ignoreSystemMetadata, setIgnoreSystemMetadata] = useState(false);
  const [treeDrawer, setTreeDrawer] = useState<DriveGroup | null>(null);
  const [treeLimit, setTreeLimit] = useState(200);
  const [undoBatch, setUndoBatch] = useState<UndoBatch | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [healthHistory, setHealthHistory] = useState<HealthHistory[]>([]);
  const [profile, setProfile] = useState("project");
  const [planProvider, setPlanProvider] = useState("Google One");
  const [planPrice, setPlanPrice] = useState(0);
  const [planCapacityGb, setPlanCapacityGb] = useState(100);
  const cancelRef = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        const status = isObject(body) ? body : {};
        setConnected(Boolean(status.connected));
        setConfigured(status.configured !== false);
        if (isObject(status.user)) {
          setAccount({
            displayName: typeof status.user.displayName === "string" ? status.user.displayName : undefined,
            emailAddress: typeof status.user.emailAddress === "string" ? status.user.emailAddress : undefined,
            photoLink: typeof status.user.photoLink === "string" ? status.user.photoLink : undefined,
          });
        }
        if (status.configured === false) setStatus("Google OAuth 正在等待網站管理員完成啟用設定");
      })
      .catch(() => setConnected(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedHistory = JSON.parse(localStorage.getItem("dupespace-health-history") ?? "[]") as unknown;
        if (Array.isArray(savedHistory)) setHealthHistory(savedHistory.filter((item): item is HealthHistory => isObject(item) && typeof item.timestamp === "string" && typeof item.score === "number" && typeof item.reclaimedBytes === "number").slice(-12));
        const savedProfile = localStorage.getItem("dupespace-protected-profile");
        if (savedProfile && ["project", "media", "strict"].includes(savedProfile)) setProfile(savedProfile);
        const savedPlan = JSON.parse(localStorage.getItem("dupespace-roi-plan") ?? "null") as unknown;
        if (isObject(savedPlan)) {
          if (savedPlan.provider === "Google One" || savedPlan.provider === "iCloud+" || savedPlan.provider === "自訂方案") setPlanProvider(savedPlan.provider);
          if (typeof savedPlan.price === "number") setPlanPrice(savedPlan.price);
          if (typeof savedPlan.capacityGb === "number") setPlanCapacityGb(savedPlan.capacityGb);
        }
      } catch {
        // Local aggregate preferences are optional and never required for cleaning.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!confirmation || confirmation.stage !== 2 || confirmation.mode !== "permanent" || countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => {
      if (value <= 1) { window.clearInterval(timer); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [confirmation, countdown]);

  useEffect(() => {
    if (!undoBatch) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((undoBatch.expiresAt - Date.now()) / 1000));
      setUndoSeconds(remaining);
      if (remaining === 0) setUndoBatch(null);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [undoBatch]);

  const records = useMemo(() => scan?.groups.flatMap((group) => group.records) ?? [], [scan]);
  const selectedRecords = useMemo(() => records.filter((record) => selected.has(record.id)), [records, selected]);
  const selectedBytes = selectedRecords.reduce((total, record) => total + record.size, 0);
  const quotaLimit = Number(scan?.storageQuota?.limit ?? 0);
  const reclaimPercent = percent(selectedBytes, scan?.reclaimableBytes ?? 0);
  const quotaPercent = percent(selectedBytes, quotaLimit);
  const healthScore = scan ? calculateHealthScore(quotaLimit, scan.reclaimableBytes, scan.groups.length) : null;
  const healthState = healthScore === null ? { level: "unscanned", label: "等待第一次掃描", detail: "連線後開始分析" } as const : getHealthState(healthScore);
  const HealthIcon = healthState.level === "unscanned" ? ScanSearch : healthState.level === "critical" ? AlertTriangle : healthState.level === "moderate" ? AlertCircle : ShieldCheck;
  const roiEstimate = planCapacityGb > 0 ? actualBytes / (planCapacityGb * GIB) * planPrice : 0;
  const causes = useMemo(() => {
    const result = { download: 0, messaging: 0, copied: 0, other: 0 };
    for (const record of records.filter((item) => !item.keeper)) {
      const path = record.path.toLowerCase();
      if (/download|下載/.test(path)) result.download += 1;
      else if (/line|wechat|whatsapp|messenger|telegram|slack|teams|通訊/.test(path)) result.messaging += 1;
      else if (path.includes("/") || path.includes("\\")) result.copied += 1;
      else result.other += 1;
    }
    return result;
  }, [records]);
  const expectedPhrase = confirmation ? `永久刪除 ${confirmation.records.length} 個檔案` : "";
  const needsSecond = confirmation ? confirmation.records.length > 5 : false;
  const largeRisk = confirmation ? confirmation.records.length >= 500 || confirmation.records.reduce((sum, item) => sum + item.size, 0) >= GIB || confirmation.records.length >= 5000 : false;

  function play(kind: Parameters<typeof synthSound>[0]): void {
    synthSound(kind, DEFAULT_SOUND_VOLUME);
  }

  function rememberHealth(score: number, reclaimedBytes: number): void {
    setHealthHistory((current) => {
      const last = current.at(-1);
      if (last?.score === score && last.reclaimedBytes === reclaimedBytes) return current;
      const next = [...current, { timestamp: new Date().toISOString(), score, reclaimedBytes }].slice(-12);
      localStorage.setItem("dupespace-health-history", JSON.stringify(next));
      return next;
    });
  }

  function animatedWait(target = 88): number {
    return window.setInterval(() => setProgress((current) => Math.min(target, current + Math.max(.4, (target - current) * .06))), 180);
  }

  async function startScan(): Promise<void> {
    play("confirm");
    setRunning(true); setProgress(2); setStatus("正在讀取 Google Drive 中的檔案與校驗碼…");
    const timer = animatedWait();
    try {
      const response = await fetch("/api/google/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ignoreSystemMetadata, protectedProfile: profile }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body, "掃描失敗"));
      if (!isScanResult(body)) throw new Error("Google Drive 回傳了無效的掃描資料");
      setScan(body);
      setUndoBatch(null);
      setAccount(body.user);
      setMode("trash");
      setSelected(new Set(body.groups.flatMap((group: DriveGroup) => group.records
        .filter((record) => !record.keeper && record.canTrash && record.autoSelectable)
        .map((record) => record.id))));
      setStatus(body.duplicateCopies
        ? `掃描完成：找到 ${body.duplicateCopies.toLocaleString()} 個重複檔案或資料夾副本`
        : "掃描完成，目前沒有內容完全相同的檔案或資料夾");
      setProgress(100);
      rememberHealth(calculateHealthScore(Number(body.storageQuota?.limit ?? 0), body.reclaimableBytes, body.groups.length), actualBytes);
      play(body.duplicateCopies ? "confirm" : "success");
    } catch (error) {
      setProgress(0); setStatus(error instanceof Error ? error.message : "掃描失敗"); play("error");
    } finally {
      window.clearInterval(timer); setRunning(false);
    }
  }

  function selectable(record: DriveRecord, targetMode = mode): boolean {
    if (record.keeper) return false;
    return targetMode === "trash" ? record.canTrash : record.canDelete;
  }

  function chooseMode(next: OperationMode): void {
    if (running || mode === next) return;
    setMode(next);
    setSelected(next === "trash"
      ? new Set(records.filter((record) => !record.keeper && record.canTrash && record.autoSelectable).map((record) => record.id))
      : new Set());
    setStatus(next === "trash" ? "已選取全部可移至垃圾桶的重複副本" : "永久刪除無法復原；請主動選取要永久刪除的副本");
    play(next === "permanent" ? "warning" : "confirm");
  }

  function toggle(record: DriveRecord): void {
    if (!selectable(record) || running) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(record.id)) next.delete(record.id); else next.add(record.id);
      return next;
    });
  }

  function requestOperation(): void {
    if (!selectedRecords.length || running) return;
    if (mode === "trash") {
      play("confirm");
      void executeOperation("trash", selectedRecords);
      return;
    }
    setConfirmation({ mode, records: selectedRecords, stage: 1 });
    setConfirmationText(""); setCountdown(0);
    play("warning");
  }

  function acceptConfirmation(): void {
    if (!confirmation) return;
    const requiresSecond = needsSecond || largeRisk;
    if (confirmation.stage === 1 && requiresSecond) {
      setCountdown(confirmation.mode === "permanent" && largeRisk ? 8 : 0);
      setConfirmation({ ...confirmation, stage: 2 });
      setConfirmationText("");
      play("warning");
      return;
    }
    if (confirmation.mode === "permanent" && confirmation.stage === 2 && confirmationText !== expectedPhrase) return;
    if (confirmation.mode === "permanent" && countdown > 0) return;
    const accepted = confirmation;
    setConfirmation(null);
    void executeOperation(accepted.mode, accepted.records);
  }

  async function executeOperation(targetMode: OperationMode, items: DriveRecord[]): Promise<void> {
    setRunning(true); setProgress(0); cancelRef.current = false;
    let completed = 0; let reclaimed = 0; let failures = 0;
    let remainingScan = scan;
    const restorable: DriveRecord[] = [];
    const chunks: DriveRecord[][] = [];
    for (let index = 0; index < items.length; index += MUTATION_BATCH_SIZE) chunks.push(items.slice(index, index + MUTATION_BATCH_SIZE));
    try {
      for (const chunk of chunks) {
        if (cancelRef.current) break;
        setStatus(`${targetMode === "trash" ? "正在移至垃圾桶" : "正在永久刪除"}：${completed.toLocaleString()} / ${items.length.toLocaleString()}`);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), OPERATION_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(`/api/google/${targetMode === "trash" ? "trash" : "delete"}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: chunk.map((record) => ({ id: record.id, proof: record.proof })) }),
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeout);
        }
        const body = await response.json();
        if (!response.ok) throw new Error(errorMessage(body, "批次清理失敗"));
        if (!isObject(body) || !Array.isArray(body.outcomes) || !body.outcomes.every(isAuditOutcome)) {
          throw new Error("Google Drive 回傳了無效的操作結果");
        }
        const outcomes = body.outcomes;
        setAudit((current) => [...current, ...outcomes]);
        const successfulIds = new Set(outcomes.filter((outcome) => outcome.status === "trashed" || outcome.status === "deleted").map((outcome) => outcome.id));
        if (targetMode === "trash") restorable.push(...chunk.filter((record) => successfulIds.has(record.id)));
        for (const outcome of outcomes) {
          if (outcome.status === "trashed" || outcome.status === "deleted") {
            reclaimed += outcome.size;
            setSelected((current) => { const next = new Set(current); next.delete(outcome.id); return next; });
          } else failures += 1;
        }
        if (successfulIds.size) {
          remainingScan = remainingScan ? removeSuccessfulRecords(remainingScan, successfulIds) : remainingScan;
          setScan(remainingScan);
        }
        completed += chunk.length;
        setActualBytes((value) => value + outcomes.filter((item) => item.status === "trashed" || item.status === "deleted").reduce((sum, item) => sum + item.size, 0));
        setProgress(completed / items.length * 100);
      }
      setStatus(cancelRef.current
        ? `已安全停止；本次已處理 ${formatBytes(reclaimed)}`
        : `完成：Google Drive 已確認移除 ${formatBytes(reclaimed)}${failures ? `，${failures} 個檔案因安全檢查未處理` : ""}`);
      play(failures ? "error" : targetMode === "trash" ? "trash" : "deleted");
      if (targetMode === "trash" && restorable.length) setUndoBatch({ items: restorable, expiresAt: Date.now() + 10_000 });
      if (remainingScan) rememberHealth(calculateHealthScore(Number(remainingScan.storageQuota?.limit ?? 0), remainingScan.reclaimableBytes, remainingScan.groups.length), actualBytes + reclaimed);
      if (!failures && !cancelRef.current) window.setTimeout(() => play("success"), 380);
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError"
        ? "伺服器回應逾時；為避免重複操作，請按「重新掃描」確認 Google Drive 最新狀態"
        : error instanceof Error ? error.message : "清理未完成");
      play("error");
    } finally { setRunning(false); }
  }

  async function undoTrash(): Promise<void> {
    if (!undoBatch || running || undoSeconds <= 0) return;
    const items = undoBatch.items;
    setUndoBatch(null);
    setRunning(true);
    setProgress(4);
    setStatus(`正在從 Google Drive 垃圾桶復原 ${items.length.toLocaleString()} 個項目`);
    let restoredBytes = 0;
    let restoredCount = 0;
    let failures = 0;
    try {
      for (let index = 0; index < items.length; index += MUTATION_BATCH_SIZE) {
        const chunk = items.slice(index, index + MUTATION_BATCH_SIZE);
        const response = await fetch("/api/google/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: chunk.map((record) => ({ id: record.id, proof: record.proof })) }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(errorMessage(body, "快速復原失敗"));
        if (!isObject(body) || !Array.isArray(body.outcomes) || !body.outcomes.every(isAuditOutcome)) throw new Error("Google Drive 回傳了無效的復原結果");
        const outcomes = body.outcomes;
        setAudit((current) => [...current, ...outcomes]);
        for (const outcome of outcomes) {
          if (outcome.status === "restored") { restoredCount += 1; restoredBytes += outcome.size; }
          else failures += 1;
        }
        setProgress(Math.min(100, (index + chunk.length) / items.length * 100));
      }
      setActualBytes((value) => Math.max(0, value - restoredBytes));
      setStatus(failures ? `已復原 ${restoredCount.toLocaleString()} 個項目；${failures.toLocaleString()} 個項目請至 Google Drive 垃圾桶確認` : `已從垃圾桶復原 ${restoredCount.toLocaleString()} 個項目，正在重新掃描`);
      play(failures ? "error" : "success");
      setRunning(false);
      if (restoredCount) await startScan();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "快速復原失敗；請至 Google Drive 垃圾桶手動復原");
      play("error");
      setRunning(false);
    }
  }

  function downloadCsv(): void {
    const columns = ["timestamp", "source", "operation_mode", "status", "item_kind", "name", "path", "file_id", "size", "checksum", "reason"];
    const lines = [columns.map(csvCell).join(","), ...audit.map((item) => [
      item.timestamp, "google_drive", item.operationMode, item.status, item.itemKind, item.name, item.path, item.id,
      item.size, item.checksum, item.reason,
    ].map(csvCell).join(","))];
    const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `DUPESPACE-audit-${new Date().toISOString().replaceAll(":", "-")}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function disconnect(): Promise<void> {
    await fetch("/api/google/disconnect", { method: "POST" });
    setConnected(false); setAccount(null); setScan(null); setSelected(new Set()); setProgress(0); setStatus("已中斷 Google Drive 連線");
  }

  if (checking) return <div className="cleaner-loading"><LoaderCircle className="animate-spin" size={42} aria-hidden="true" /><span>正在確認安全連線</span></div>;

  return (
    <div className="cleaner-app">
      <ol className="flow-steps" aria-label="清理流程">
        {["登入", "掃描", "檢查", "清理"].map((label, index) => <li key={label} className={connected && index === 0 ? "done" : scan && index < 3 ? "done" : running && index === 3 ? "active" : ""}><span>{index + 1}</span><b>{label}</b></li>)}
      </ol>
      <section className="cleaner-statusbar">
        <div className="cleaner-actions">
          {!connected ? <a className={`button primary ${configured ? "" : "disabled"}`} aria-disabled={!configured} href={configured ? "/api/google/start" : "#oauth-setup"}><LogIn size={17} aria-hidden="true" />{configured ? "使用 Google 登入" : "Google 登入設定中"}</a> : <>
            <button className="button primary" onClick={startScan} disabled={running}><ScanSearch size={17} aria-hidden="true" />{scan ? "重新掃描" : "開始掃描"}</button>
            <button className="text-button" onClick={disconnect} disabled={running}>中斷連線</button>
          </>}
        </div>
        <div className="account">
          {account?.photoLink ? <img src={account.photoLink} alt={`${account.displayName ?? "Google"} 帳號頭像`} referrerPolicy="no-referrer" /> : <span className={`account-dot ${connected ? "online" : ""}`} />}{/* eslint-disable-line @next/next/no-img-element */}
          <div><b>{account?.displayName ?? (connected ? "Google Drive 已連線" : "尚未連線")}</b><small>{account?.emailAddress ?? "登入帳號顯示於此"}</small></div>
        </div>
      </section>
      <label className="metadata-option">
        <input
          type="checkbox"
          aria-label="忽略系統暫存檔"
          checked={ignoreSystemMetadata}
          disabled={running}
          onChange={(event) => {
            setIgnoreSystemMetadata(event.target.checked);
            setScan(null);
            setSelected(new Set());
            setTreeDrawer(null);
            setStatus("系統暫存檔規則已變更，請重新掃描 Google Drive");
          }}
        />
        <AlertTriangle size={18} aria-hidden="true" /><span><b>進階：忽略系統暫存檔</b><small>預設關閉。開啟後，.DS_Store、Thumbs.db、desktop.ini 不參與資料夾鏡像比對；移除資料夾時仍會一併進垃圾桶。</small></span>
      </label>

      <section className={`health-panel ${healthState.level}`} aria-label="儲存空間健康評分">
        <div className="health-score-ring">
          <svg viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="47" /><motion.circle cx="54" cy="54" r="47" pathLength={100} strokeDasharray="100" animate={{ strokeDashoffset: 100 - (healthScore ?? 0) }} transition={{ duration: reducedMotion ? 0 : .8, ease: "easeOut" }} /></svg>
          <div><motion.strong key={healthScore ?? "pending"} initial={reducedMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }}>{healthScore ?? "—"}</motion.strong>{healthScore !== null && <small>/100</small>}</div>
        </div>
        <div className="health-copy"><span><HealthIcon size={18} aria-hidden="true" />{healthState.label}</span><h2>{healthScore === null ? "掃描後建立空間健康評分" : `空間健康評分：${healthScore}/100`}</h2><p>{healthState.detail}。{healthScore === null ? "尚未分析 Google Drive，不顯示推測分數。" : "此分數只依本次偵測到的重複容量與群組數計算，是整理指標，不是磁碟故障或效能診斷。"}</p></div>
        <div className="health-summary"><span>目前重複容量</span><b>{scan ? formatBytes(scan.reclaimableBytes) : "尚未分析"}</b><small>{scan ? `${scan.groups.length.toLocaleString()} 個重複群組` : "完成掃描後顯示"}</small></div>
      </section>

      <section className="metric-grid">
        <article><span>預估節省容量</span><strong>{formatBytes(selectedBytes)}</strong><small>實際已釋放 {formatBytes(actualBytes)}</small></article>
        <article><span>重複容量百分比</span><strong>{reclaimPercent.toFixed(1)}%</strong><small>{selected.size.toLocaleString()} 個已選副本</small></article>
        <article><span>磁碟容量占比</span><strong>{quotaLimit ? `${quotaPercent.toFixed(3)}%` : "—"}</strong><small>{quotaLimit ? `雲端總容量 ${formatBytes(quotaLimit)}` : "Google 未提供容量上限"}</small></article>
      </section>

      <section className="insight-grid" aria-label="長期儲存整理工具">
        <article className="trend-card"><div className="insight-heading"><TrendingUp size={18} aria-hidden="true" /><span><b>儲存健康趨勢</b><small>僅儲存本機彙總分數</small></span></div><div className="trend-bars" aria-label="最近健康評分">
          {(healthHistory.length ? healthHistory : [{ timestamp: "", score: healthScore ?? 0, reclaimedBytes: actualBytes }]).map((item, index) => <i key={`${item.timestamp}-${index}`} style={{ height: `${Math.max(12, item.score)}%` }} title={healthScore === null && !healthHistory.length ? "尚未掃描" : `${item.score}/100`} />)}
        </div></article>
        <article><div className="insight-heading"><Cloud size={18} aria-hidden="true" /><span><b>容量費用等值估算</b><small>自行輸入方案，不採用即時價格宣稱</small></span></div><div className="roi-fields"><label>方案<select value={planProvider} onChange={(event) => { setPlanProvider(event.target.value); localStorage.setItem("dupespace-roi-plan", JSON.stringify({ provider: event.target.value, price: planPrice, capacityGb: planCapacityGb })); }}><option>Google One</option><option>iCloud+</option><option>自訂方案</option></select></label><label>每月費用<input type="number" min="0" value={planPrice} onChange={(event) => { const value = Math.max(0, Number(event.target.value)); setPlanPrice(value); localStorage.setItem("dupespace-roi-plan", JSON.stringify({ provider: planProvider, price: value, capacityGb: planCapacityGb })); }} /></label><label>方案容量 GB<input type="number" min="1" value={planCapacityGb} onChange={(event) => { const value = Math.max(1, Number(event.target.value)); setPlanCapacityGb(value); localStorage.setItem("dupespace-roi-plan", JSON.stringify({ provider: planProvider, price: planPrice, capacityGb: value })); }} /></label></div><strong className="roi-value">{planProvider} 約 NT$ {roiEstimate.toFixed(2)} 容量等值</strong></article>
        <article><div className="insight-heading"><ShieldCheck size={18} aria-hidden="true" /><span><b>防護設定檔</b><small>偏好只保存在這個瀏覽器</small></span></div><label className="profile-select">整理情境<select value={profile} onChange={(event) => { setProfile(event.target.value); localStorage.setItem("dupespace-protected-profile", event.target.value); setScan(null); setSelected(new Set()); setStatus("防護設定檔已變更，請重新掃描"); }}><option value="project">軟體專案保護</option><option value="media">影音備份保護</option><option value="strict">嚴格保護</option></select></label><small className="profile-note">軟體專案模式預選符合門檻的檔案與鏡像資料夾；影音備份模式不預選資料夾；嚴格模式不自動預選。硬性排除永遠有效。</small></article>
        <article><div className="insight-heading"><FolderTree size={18} aria-hidden="true" /><span><b>重複成因分析</b><small>依檔案路徑線索推估</small></span></div><div className="cause-list">{[["下載項目", causes.download], ["通訊軟體", causes.messaging], ["跨資料夾複製", causes.copied], ["其他", causes.other]].map(([label, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Math.max(4, Number(value) / Math.max(1, records.length) * 100)}%` }} /></i><strong>{value}</strong></div>)}</div></article>
      </section>

      <section className="animated-progress" aria-live="polite">
        <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
        <div className={`progress-track ${running ? "running" : ""}`}><i style={{ width: `${progress}%` }} /></div>
        {running && <button className="text-button" onClick={() => { cancelRef.current = true; setStatus("將在目前批次完成後安全停止"); }}><Square size={13} aria-hidden="true" />安全停止</button>}
      </section>

      {scan && <>
        <section className="mode-section" aria-labelledby="mode-title">
          <div><span className="eyebrow"><ShieldCheck size={14} aria-hidden="true" /> 步驟 4</span><h2 id="mode-title">選擇處理方式</h2><p>檔案與完整鏡像資料夾都可移至垃圾桶；資料夾永遠不能永久刪除。垃圾桶失敗絕不會自動改成永久刪除。</p></div>
          <div className="mode-options">
            <label htmlFor="mode-trash" className={`mode-card recommended ${mode === "trash" ? "selected" : ""}`}><span className="sr-only">選擇移至垃圾桶</span><input id="mode-trash" aria-label="移至垃圾桶" type="radio" name="mode" checked={mode === "trash"} onChange={() => chooseMode("trash")} disabled={running} /><span><b>移至垃圾桶</b><small>預設、建議。仍可從 Google Drive 垃圾桶復原。</small><em>建議</em></span></label>
            <label htmlFor="mode-permanent" className={`mode-card high-risk ${mode === "permanent" ? "selected" : ""}`}><span className="sr-only">選擇立即永久刪除</span><input id="mode-permanent" aria-label="立即永久刪除" type="radio" name="mode" checked={mode === "permanent"} onChange={() => chooseMode("permanent")} disabled={running} /><span><b>立即永久刪除</b><small>高風險進階功能，刪除後沒有任何復原方式。</small><em>無法復原</em></span></label>
          </div>
        </section>
        <div className="results-toolbar">
          <div><b>{scan.groups.length.toLocaleString()} 組 · {scan.duplicateCopies.toLocaleString()} 個重複副本</b><span>掃描 {scan.examined.toLocaleString()} 個項目，略過 {scan.skipped.toLocaleString()} 個不適用項目；其中 {scan.projectProtected.toLocaleString()} 個專案項目受到硬性保護</span></div>
          <div><button className="text-button" onClick={() => setSelected(new Set(records.filter((record) => selectable(record)).map((record) => record.id)))} disabled={mode === "permanent"}>選取全部重複副本</button><button className="text-button" onClick={() => setSelected(new Set())}>清除選取</button></div>
        </div>
        {!scan.groups.length && <div className="empty-state"><ShieldCheck size={36} aria-hidden="true" /><h3>目前很乾淨</h3><p>沒有找到可安全比對的重複檔案或完整鏡像資料夾。</p></div>}
        <div className="group-list">
          {scan.groups.slice(0, visibleGroups).map((group, groupIndex) => {
            const key = `${group.fingerprint}-${groupIndex}`;
            const limit = recordLimits[key] ?? 80;
            return <details className="duplicate-group" key={key} open={groupIndex < 3}>
              <summary><span><b>{group.itemKind === "folder" ? "重複資料夾" : "重複檔案"}群組 {groupIndex + 1}</b><small>{group.records.length.toLocaleString()} 份相同內容{group.itemKind === "folder" ? ` · ${group.tree.length.toLocaleString()} 個檔案 100% 鏡像對齊` : ""}</small></span><strong>{formatBytes(group.reclaimableBytes)}</strong></summary>
              {group.itemKind === "folder" && <div className="folder-match-banner"><span><CheckCircle2 size={13} aria-hidden="true" />100% 鏡像對齊</span><b>{group.tree.length.toLocaleString()} 個檔案，完整路徑、大小與校驗碼一致</b><button className="text-button" onClick={() => { setTreeDrawer(group); setTreeLimit(200); }}><FolderTree size={14} aria-hidden="true" />開啟雙樹比對</button></div>}
              <div className="record-list">
                {group.records.slice(0, limit).map((record) => <label className={`record ${record.keeper ? "keeper" : selected.has(record.id) ? "selected" : ""}`} key={record.id}>
                  <input type="checkbox" checked={!record.keeper && selected.has(record.id)} disabled={!selectable(record) || running} onChange={() => toggle(record)} />
                  <span className="file-preview">{record.thumbnailLink ? <img src={record.thumbnailLink} alt={`${record.name} 預覽`} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : record.itemKind === "folder" ? <Folder size={22} aria-hidden="true" /> : <File size={22} aria-hidden="true" />}</span>{/* eslint-disable-line @next/next/no-img-element */}
                  <span className="record-name"><b>{record.name}</b><small className="record-path">{record.path}</small><small>{record.itemKind === "folder" ? `${record.entryCount.toLocaleString()} 個可比對檔案${record.ignoredMetadataCount ? ` · 忽略 ${record.ignoredMetadataCount} 個暫存檔` : ""}` : record.modifiedTime ? new Date(record.modifiedTime).toLocaleString("zh-TW") : "日期不明"}{record.webViewLink ? <> · <a href={record.webViewLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Eye size={11} aria-hidden="true" />在 Drive 預覽</a></> : null}</small></span>
                  <span className="record-size">{formatBytes(record.size)}</span>
                  <span className={`record-state ${record.keeper ? "safe" : !selectable(record) ? "locked" : ""}`}>{record.keeper ? "保留" : mode === "permanent" && record.itemKind === "folder" ? "僅限垃圾桶" : !selectable(record) ? "無權限" : selected.has(record.id) ? (mode === "trash" ? "垃圾桶" : "永久刪除") : "略過"}</span>
                </label>)}
                {group.records.length > limit && <button className="load-more" onClick={() => setRecordLimits((current) => ({ ...current, [key]: limit + 160 }))}>再顯示 {Math.min(160, group.records.length - limit)} 個副本</button>}
              </div>
            </details>;
          })}
        </div>
        {scan.groups.length > visibleGroups && <button className="load-more" onClick={() => setVisibleGroups((value) => value + 24)}>載入更多重複群組</button>}
        <div className={`trash-dock ${mode === "permanent" ? "permanent" : ""}`}><div><span>已選 {selected.size.toLocaleString()} 個副本 · {scan.groups.length.toLocaleString()} 個群組</span><strong>可節省 {formatBytes(selectedBytes)} · {reclaimPercent.toFixed(1)}%</strong></div><div className="dock-actions">{audit.length > 0 && <button className="button secondary" onClick={downloadCsv}><Download size={16} aria-hidden="true" />下載 CSV 稽核報告</button>}<button className={`button ${mode === "trash" ? "primary" : "danger"}`} onClick={requestOperation} disabled={!selected.size || running}>{mode === "trash" ? <><Trash2 size={17} aria-hidden="true" />移至 Google Drive 垃圾桶</> : <><AlertTriangle size={17} aria-hidden="true" />立即永久刪除（無法復原）</>}</button></div></div>
      </>}

      {treeDrawer && (() => {
        const keeper = treeDrawer.records.find((record) => record.keeper) as DriveRecord;
        const target = treeDrawer.records.find((record) => !record.keeper) as DriveRecord;
        return <div className="tree-drawer-backdrop">
          <aside className="tree-drawer" role="dialog" aria-modal="true" aria-labelledby="tree-drawer-title">
            <button className="modal-close" aria-label="關閉資料夾比對" onClick={() => setTreeDrawer(null)}><X size={18} aria-hidden="true" /></button>
            <span className="eyebrow"><FolderTree size={14} aria-hidden="true" /> SIDE-BY-SIDE TREE DIFF</span>
            <h2 id="tree-drawer-title">保留目錄與待清目錄</h2>
            <div className="mirror-score"><span><CheckCircle2 size={20} aria-hidden="true" /></span><div><b>100% 鏡像對齊</b><small>{treeDrawer.tree.length.toLocaleString()} 個檔案的相對路徑、大小與內容校驗碼完全一致</small></div></div>
            <div className="tree-paths"><div><span>保留目錄</span><b>{keeper.path}</b></div><div><span>待清目錄</span><b>{target.path}</b></div></div>
            <div className="tree-columns" aria-label="資料夾檔案樹對照">
              {[keeper, target].map((record) => <div key={record.id}><h3>{record.keeper ? "受保護 · 永遠保留" : "待清理 · 移至垃圾桶"}</h3>{treeDrawer.tree.slice(0, treeLimit).map((entry) => <div className="tree-entry" key={`${record.id}-${entry.relativePath}`}><span>{entry.relativePath}</span><small>{formatBytes(entry.size)}</small></div>)}</div>)}
            </div>
            {treeDrawer.tree.length > treeLimit && <button className="load-more" onClick={() => setTreeLimit((value) => value + 400)}>再顯示 {Math.min(400, treeDrawer.tree.length - treeLimit).toLocaleString()} 個檔案</button>}
          </aside>
        </div>;
      })()}

      {confirmation && <div className="modal-backdrop" role="presentation" onKeyDown={(event) => { if (event.key === "Escape") setConfirmation(null); if (confirmation.mode === "permanent" && event.key === "Enter") event.preventDefault(); }}>
        <section className={`confirm-modal ${confirmation.mode === "permanent" ? "permanent" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <button className="modal-close" aria-label="取消" onClick={() => setConfirmation(null)}><X size={18} aria-hidden="true" /></button>
          <span className="warning-icon">{confirmation.mode === "trash" ? <Trash2 size={26} aria-hidden="true" /> : <AlertTriangle size={26} aria-hidden="true" />}</span>
          <p className="confirm-kicker">{confirmation.stage === 2 ? "第二層安全確認" : confirmation.mode === "trash" ? "一般確認" : "高風險功能"}</p>
          <h2 id="confirm-title">{confirmation.mode === "trash" ? "移至 Google Drive 垃圾桶？" : "永久刪除，沒有復原功能"}</h2>
          <p>{confirmation.mode === "trash" ? "選取檔案會移至垃圾桶，仍可依 Google Drive 的保留政策復原。" : "這不是清空垃圾桶；選取檔案會立即從 Google Drive 永久消失。"}</p>
          <dl className="confirm-summary"><div><dt>選取數量</dt><dd>{confirmation.records.length.toLocaleString()} 個檔案</dd></div><div><dt>重複群組</dt><dd>{new Set(confirmation.records.map((record) => scan?.groups.findIndex((group) => group.records.some((item) => item.id === record.id)))).size.toLocaleString()} 組</dd></div><div><dt>預計釋放</dt><dd>{formatBytes(confirmation.records.reduce((sum, record) => sum + record.size, 0))}</dd></div><div><dt>掃描位置</dt><dd>我的 Google Drive</dd></div><div><dt>處理方式</dt><dd>{confirmation.mode === "trash" ? "移至垃圾桶（可復原）" : "永久刪除（無法復原）"}</dd></div></dl>
          {confirmation.mode === "permanent" && confirmation.stage === 2 && <label className="typed-confirm"><span>請完整輸入：<b>{expectedPhrase}</b></span><input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} autoComplete="off" /></label>}
          {largeRisk && confirmation.stage === 2 && <div className="countdown-warning"><b>大量永久刪除保護</b><span>完整摘要已顯示。{countdown > 0 ? `請等待 ${countdown} 秒` : "等待完成，請再次核對內容"}</span></div>}
          <div className="modal-actions"><button className="button secondary" onClick={() => setConfirmation(null)}>取消，保留檔案</button><button className={`button ${confirmation.mode === "trash" ? "primary" : "danger"}`} onClick={acceptConfirmation} disabled={confirmation.mode === "permanent" && confirmation.stage === 2 && (confirmationText !== expectedPhrase || countdown > 0)}>{confirmation.stage === 1 && (confirmation.mode === "permanent" ? needsSecond || largeRisk : needsSecond) ? "繼續安全確認" : confirmation.mode === "trash" ? "確認移至垃圾桶" : "確認永久刪除（無法復原）"}</button></div>
        </section>
      </div>}
      {undoBatch && <motion.aside className="undo-toast" role="status" aria-live="polite" initial={reducedMotion ? false : { opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="undo-copy"><CheckCircle2 size={20} aria-hidden="true" /><span><b>已移至 Google Drive 垃圾桶</b><small>共 {undoBatch.items.length.toLocaleString()} 個項目，可在 {undoSeconds} 秒內快速復原</small></span></div>
        <button type="button" onClick={undoTrash} disabled={running || undoSeconds <= 0}><RotateCcw size={16} aria-hidden="true" />復原</button>
        <i aria-hidden="true"><motion.span initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: reducedMotion ? 0 : 10, ease: "linear" }} /></i>
      </motion.aside>}
    </div>
  );
}
