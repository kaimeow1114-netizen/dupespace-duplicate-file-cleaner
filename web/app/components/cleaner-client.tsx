"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Download,
  Eye,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderTree,
  Layers3,
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
import { GroupThumbnail } from "./group-thumbnail";
import { AnimatedNumber } from "./animated-number";
import { capacityEquivalent, storageMetrics } from "../../lib/storage-metrics";
import { canSelectCopy, hasCompleteOutcomes, readJsonWithTimeout } from "../../lib/operation-results";
import { cacheEpoch, clearDriveIndex, INDEX_CLEARED_EVENT, isIndexEpochEvent, isSessionDisconnectEvent, readDriveIndex, validDriveIndex, writeDriveIndex, type CachedDriveIndex } from "../../lib/drive-index";
import { cleanerTranslator, type CleanerLocale } from "../../lib/cleaner-i18n";

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
  cache?: CachedDriveIndex | null;
  scanMode?: "full" | "incremental";
  examined: number;
  examinedBytes: number;
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
  refreshedProof?: string;
  refreshedVersion?: string;
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
type UndoBatch = { items: DriveRecord[]; groups: DriveGroup[]; expiresAt: number };
type HealthHistory = { timestamp: string; score: number; reclaimedBytes: number };
type GroupCategory = "video" | "image" | "pdf" | "document" | "audio" | "folder" | "archive" | "other";

const GIB = 1024 ** 3;
const MUTATION_BATCH_SIZE = 10;
const OPERATION_TIMEOUT_MS = 45_000;
const DEFAULT_SOUND_VOLUME = .22;
const CATEGORY_ORDER: GroupCategory[] = ["video", "image", "pdf", "document", "audio", "folder", "archive", "other"];
const CATEGORY_LABELS: Record<GroupCategory, string> = {
  video: "影片",
  image: "圖片",
  pdf: "PDF",
  document: "重要文件",
  audio: "音訊",
  folder: "資料夾",
  archive: "壓縮檔",
  other: "其他",
};

function groupCategory(group: DriveGroup): GroupCategory {
  if (group.itemKind === "folder") return "folder";
  const record = group.records[0];
  const mime = record?.mimeType.toLowerCase() ?? "";
  const name = record?.name.toLowerCase() ?? "";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (/word|document|spreadsheet|presentation|text|rtf|epub|opendocument/.test(mime) || /\.(docx?|xlsx?|pptx?|od[ftp]|rtf|txt|csv|md)$/i.test(name)) return "document";
  if (/zip|compressed|archive|rar|7z|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name)) return "archive";
  return "other";
}

function groupKey(group: DriveGroup): string {
  return `${group.itemKind}:${group.fingerprint}:${group.records[0]?.id ?? "empty"}`;
}

function sortScanResult(result: ScanResult): ScanResult {
  return {
    ...result,
    groups: [...result.groups].sort((left, right) => {
      const categoryDifference = CATEGORY_ORDER.indexOf(groupCategory(left)) - CATEGORY_ORDER.indexOf(groupCategory(right));
      if (categoryDifference) return categoryDifference;
      return right.reclaimableBytes - left.reclaimableBytes;
    }),
  };
}

function CategoryIcon({ category, size = 17 }: { category: GroupCategory; size?: number }) {
  if (category === "video") return <FileVideo size={size} aria-hidden="true" />;
  if (category === "image") return <FileImage size={size} aria-hidden="true" />;
  if (category === "pdf" || category === "document") return <FileText size={size} aria-hidden="true" />;
  if (category === "audio") return <FileAudio size={size} aria-hidden="true" />;
  if (category === "folder") return <Folder size={size} aria-hidden="true" />;
  if (category === "archive") return <Archive size={size} aria-hidden="true" />;
  return <File size={size} aria-hidden="true" />;
}

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


function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
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
    trash: [[760, 0, .10, "sine"], [960, .125, .14, "sine"]],
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

export function CleanerClient({ locale = "zh-TW" }: { locale?: CleanerLocale }) {
  const t = useMemo(() => cleanerTranslator(locale), [locale]);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [checking, setChecking] = useState(true);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [mode, setMode] = useState<OperationMode>("trash");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState(t("連接 Google Drive 後即可開始安全掃描"));
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [actualBytes, setActualBytes] = useState(0);
  const [visibleGroups, setVisibleGroups] = useState(24);
  const [recordLimits, setRecordLimits] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<GroupCategory | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<AuditOutcome[]>([]);
  const [account, setAccount] = useState<ScanResult["user"]>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [needsRescan, setNeedsRescan] = useState(false);
  const [lastOutcomes, setLastOutcomes] = useState<Record<string, AuditOutcome>>({});
  const [countdown, setCountdown] = useState(0);
  const [treeDrawer, setTreeDrawer] = useState<DriveGroup | null>(null);
  const [treeLimit, setTreeLimit] = useState(200);
  const [undoBatch, setUndoBatch] = useState<UndoBatch | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [healthHistory, setHealthHistory] = useState<HealthHistory[]>([]);
  const [profile, setProfile] = useState("project");
  const [planProvider, setPlanProvider] = useState("Google One");
  const [planPrice, setPlanPrice] = useState(65);
  const [planCapacityGb, setPlanCapacityGb] = useState(100);
  const cancelRef = useRef(false);
  const busyRef = useRef(false);
  const cacheKeyRef = useRef<string | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const operationGeneration = useRef(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const generation = operationGeneration.current;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (generation !== operationGeneration.current) return;
        const status = isObject(body) ? body : {};
        setConnected(Boolean(status.connected));
        setConfigured(status.configured !== false);
        cacheKeyRef.current = typeof status.cacheKey === "string" ? status.cacheKey : null;
        if (!status.connected) void clearDriveIndex();
        if (isObject(status.user)) {
          setAccount({
            displayName: typeof status.user.displayName === "string" ? status.user.displayName : undefined,
            emailAddress: typeof status.user.emailAddress === "string" ? status.user.emailAddress : undefined,
            photoLink: typeof status.user.photoLink === "string" ? status.user.photoLink : undefined,
          });
        }
        if (status.configured === false) setStatus(t("Google OAuth 正在等待網站管理員完成啟用設定"));
      })
      .catch(() => setConnected(false))
      .finally(() => setChecking(false));
  }, [t]);

  useEffect(() => {
    const invalidate = (event: Event) => {
      operationGeneration.current += 1;
      scanController.current?.abort();
      setScan(null); setSelected(new Set()); setUndoBatch(null); setNeedsRescan(true);
      setAudit([]); setLastOutcomes({}); setTreeDrawer(null); setConfirmation(null);
      setStatus(""); setActualBytes(0); setProgress(0);
      if (isSessionDisconnectEvent(event)) { setConnected(false); setAccount(null); }
      cancelRef.current = true;
      cacheKeyRef.current = null;
    };
    const storage = (event: StorageEvent) => { if (isIndexEpochEvent(event)) invalidate(event); };
    window.addEventListener(INDEX_CLEARED_EVENT, invalidate);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(INDEX_CLEARED_EVENT, invalidate); window.removeEventListener("storage", storage); };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedHistory = JSON.parse(localStorage.getItem("dupespace-health-history-v3") ?? "[]") as unknown;
        if (Array.isArray(savedHistory)) setHealthHistory(savedHistory.filter((item): item is HealthHistory => isObject(item) && typeof item.timestamp === "string" && typeof item.score === "number" && typeof item.reclaimedBytes === "number").slice(-12));
        const savedProfile = localStorage.getItem("dupespace-protected-profile");
        if (savedProfile && ["project", "media", "strict"].includes(savedProfile)) setProfile(savedProfile);
        const savedPlan = JSON.parse(localStorage.getItem("dupespace-roi-plan-v2") ?? "null") as unknown;
        if (isObject(savedPlan)) {
          if (savedPlan.provider === "Google One" || savedPlan.provider === "iCloud+" || savedPlan.provider === t("自訂方案")) setPlanProvider(savedPlan.provider);
          if (typeof savedPlan.price === "number") setPlanPrice(savedPlan.price);
          if (typeof savedPlan.capacityGb === "number") setPlanCapacityGb(savedPlan.capacityGb);
        }
      } catch {
        // Local aggregate preferences are optional and never required for cleaning.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [t]);

  useEffect(() => {
    if (!confirmation || confirmation.mode !== "permanent" || countdown <= 0) return;
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
  const metrics = useMemo(() => storageMetrics(scan?.groups ?? [], scan?.examinedBytes ?? 0, quotaLimit), [scan, quotaLimit]);
  const reclaimPercent = metrics.duplicatePercent;
  const quotaPercent = metrics.quotaPercent;
  const healthScore = scan ? calculateHealthScore(quotaLimit, scan.reclaimableBytes, scan.groups.length) : null;
  const healthState = healthScore === null ? { level: "unscanned", label: t("等待第一次掃描"), detail: t("連線後開始分析") } as const : getHealthState(healthScore);
  const HealthIcon = healthState.level === "unscanned" ? ScanSearch : healthState.level === "critical" ? AlertTriangle : healthState.level === "moderate" ? AlertCircle : ShieldCheck;
  const roiEstimate = capacityEquivalent(metrics.duplicateBytes + actualBytes, planPrice, planCapacityGb);
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
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORY_ORDER.map((item) => [item, 0])) as Record<GroupCategory, number>;
    for (const group of scan?.groups ?? []) counts[groupCategory(group)] += 1;
    return counts;
  }, [scan]);
  const filteredGroups = useMemo(() => scan?.groups.filter((group) => category === "all" || groupCategory(group) === category) ?? [], [category, scan]);
  const largeRisk = confirmation ? confirmation.records.length >= 500 || confirmation.records.reduce((sum, item) => sum + item.size, 0) >= GIB || confirmation.records.length >= 5000 : false;

  function play(kind: Parameters<typeof synthSound>[0]): void {
    synthSound(kind, DEFAULT_SOUND_VOLUME);
  }

  function rememberHealth(score: number, reclaimedBytes: number): void {
    setHealthHistory((current) => {
      const last = current.at(-1);
      if (last?.score === score && last.reclaimedBytes === reclaimedBytes) return current;
      const next = [...current, { timestamp: new Date().toISOString(), score, reclaimedBytes }].slice(-12);
      try { localStorage.setItem("dupespace-health-history-v3", JSON.stringify(next)); } catch { /* Optional local history must not interrupt cleanup. */ }
      return next;
    });
  }

  function animatedWait(target = 88): number {
    return window.setInterval(() => setProgress((current) => Math.min(target, current + Math.max(.4, (target - current) * .06))), 180);
  }

  async function startScan(): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setNeedsRescan(true);
    setConfirmation(null);
    setSelected(new Set());
    setScan(null);
    setActualBytes(0);
    play("confirm");
    setRunning(true); setProgress(2); setStatus(t("正在讀取 Google Drive 中的檔案與校驗碼…"));
    const timer = animatedWait();
    const epoch = cacheEpoch();
    const generation = operationGeneration.current;
    const controller = new AbortController();
    scanController.current = controller;
    try {
      const cached = cacheKeyRef.current ? await readDriveIndex(cacheKeyRef.current) : null;
      if (cached) setStatus(t("正在同步上次掃描後的變更，並重新建立安全清理計畫…"));
      const response = await fetch("/api/google/scan", {
        signal: controller.signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ignoreSystemMetadata: false, protectedProfile: profile, snapshot: cached?.snapshot }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body, t("掃描失敗")));
      if (!isScanResult(body)) throw new Error(t("Google Drive 回傳了無效的掃描資料"));
      if (cacheEpoch() !== epoch) throw new Error(t("登入或快取狀態已變更，請重新掃描"));
      if (body.cache && validDriveIndex(body.cache, body.cache.accountKey)) {
        cacheKeyRef.current = body.cache.accountKey;
        await writeDriveIndex(body.cache, epoch);
      } else await clearDriveIndex();
      if (generation !== operationGeneration.current || cacheEpoch() !== epoch) return;
      const ordered = sortScanResult(body);
      setScan(ordered);
      setNeedsRescan(false);
      setLastOutcomes({});
      setConfirmation(null);
      setAcknowledged(false);
      setUndoBatch(null);
      setAccount(body.user);
      setMode("trash");
      setCategory("all");
      setVisibleGroups(18);
      setRecordLimits({});
      setExpandedGroups(ordered.groups[0] ? new Set([groupKey(ordered.groups[0])]) : new Set());
      setSelected(new Set(ordered.groups.flatMap((group: DriveGroup) => group.records
        .filter((record) => !record.keeper && record.canTrash && record.autoSelectable)
        .map((record) => record.id))));
      setStatus(body.duplicateCopies
        ? ("" + (body.scanMode === "incremental" ? t("變更同步完成") : t("掃描完成")) + t("：找到 ") + (body.duplicateCopies.toLocaleString()) + t(" 個重複檔案或資料夾副本"))
        : t("掃描完成，目前沒有內容完全相同的檔案或資料夾"));
      setProgress(100);
      rememberHealth(calculateHealthScore(Number(body.storageQuota?.limit ?? 0), body.reclaimableBytes, body.groups.length), actualBytes);
      play(body.duplicateCopies ? "confirm" : "success");
    } catch (error) {
      if (generation !== operationGeneration.current) return;
      setProgress(0); setStatus(controller.signal.aborted ? t("掃描已停止，沒有執行清理") : error instanceof Error ? error.message : t("掃描失敗"));
      if (!controller.signal.aborted) play("error");
    } finally {
      scanController.current = null;
      window.clearInterval(timer); setRunning(false); busyRef.current = false;
    }
  }

  function selectable(record: DriveRecord, targetMode = mode): boolean {
    return canSelectCopy(record, targetMode);
  }

  function chooseMode(next: OperationMode): void {
    if (running || mode === next) return;
    setMode(next);
    setSelected(next === "trash"
      ? new Set(records.filter((record) => !record.keeper && record.canTrash && record.autoSelectable).map((record) => record.id))
      : new Set());
    setStatus(next === "trash" ? t("已選取全部可移至垃圾桶的重複副本") : t("永久刪除無法復原；請主動選取要永久刪除的副本"));
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
    if (!selectedRecords.length || running || needsRescan || busyRef.current) return;
    if (mode === "trash") {
      play("confirm");
      void executeOperation("trash", selectedRecords);
      return;
    }
    setConfirmation({ mode, records: selectedRecords, stage: 1 });
    setAcknowledged(false);
    setCountdown(selectedRecords.length >= 500 || selectedBytes >= GIB ? 8 : 0);
    play("warning");
  }

  function acceptConfirmation(): void {
    if (!confirmation || !acknowledged || countdown > 0 || running || needsRescan) return;
    if (confirmation.mode !== mode || confirmation.records.length !== selectedRecords.length ||
      !confirmation.records.every((record) => selected.has(record.id) && selectable(record))) {
      setConfirmation(null);
      setStatus(t("選取已變更，請重新確認這次操作"));
      return;
    }
    const accepted = confirmation;
    setConfirmation(null);
    void executeOperation(accepted.mode, accepted.records);
  }

  async function executeOperation(targetMode: OperationMode, items: DriveRecord[]): Promise<void> {
    if (busyRef.current || needsRescan) return;
    busyRef.current = true;
    const generation = operationGeneration.current;
    setRunning(true); setProgress(0); cancelRef.current = false;
    let completed = 0; let reclaimed = 0; let failures = 0;
    let remainingScan = scan;
    const restorable: DriveRecord[] = [];
    const chunks: DriveRecord[][] = [];
    for (let index = 0; index < items.length; index += MUTATION_BATCH_SIZE) chunks.push(items.slice(index, index + MUTATION_BATCH_SIZE));
    try {
      for (const chunk of chunks) {
        if (generation !== operationGeneration.current) return;
        if (cancelRef.current) break;
        setStatus(`${targetMode === "trash" ? t("正在移至垃圾桶") : t("正在永久刪除")}：${completed.toLocaleString()} / ${items.length.toLocaleString()}`);
        const { response, body } = await readJsonWithTimeout(`/api/google/${targetMode === "trash" ? "trash" : "delete"}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: chunk.map((record) => ({ id: record.id, proof: record.proof })) }),
          }, OPERATION_TIMEOUT_MS);
        if (generation !== operationGeneration.current) return;
        if (!response.ok) throw new Error(errorMessage(body, t("批次清理失敗")));
        if (!isObject(body) || !Array.isArray(body.outcomes) || !body.outcomes.every(isAuditOutcome)) {
          throw new Error(t("Google Drive 回傳了無效的操作結果"));
        }
        const outcomes = body.outcomes;
        if (!hasCompleteOutcomes(chunk.map((item) => item.id), outcomes, targetMode)) {
          throw new Error(t("Google Drive 未完整回報這批結果，請重新掃描確認最新狀態"));
        }
        setAudit((current) => [...current, ...outcomes]);
        setLastOutcomes((current) => ({ ...current, ...Object.fromEntries(outcomes.map((item) => [item.id, item])) }));
        const successfulIds = new Set(outcomes.filter((outcome) => outcome.status === "trashed" || outcome.status === "deleted").map((outcome) => outcome.id));
        if (targetMode === "trash") restorable.push(...chunk.filter((record) => successfulIds.has(record.id)));
        for (const outcome of outcomes) {
          if (outcome.status === "trashed" || outcome.status === "deleted") {
            reclaimed += outcome.size;
            setSelected((current) => { const next = new Set(current); next.delete(outcome.id); return next; });
          } else { failures += 1; setNeedsRescan(true); }
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
        ? (t("已安全停止；本次已處理 ") + (formatBytes(reclaimed)) + "")
        : (t("完成：Google Drive 已確認移除 ") + (formatBytes(reclaimed)) + "" + (failures ? ("；" + (failures) + t(" 項未處理，原因已標在副本旁。請重新掃描後再整理")) : "") + ""));
      play(failures ? "error" : targetMode === "trash" ? "trash" : "deleted");
      if (targetMode === "trash" && restorable.length) setUndoBatch({ items: restorable, groups: scan?.groups ?? [], expiresAt: Date.now() + 10_000 });
      if (remainingScan) rememberHealth(calculateHealthScore(Number(remainingScan.storageQuota?.limit ?? 0), remainingScan.reclaimableBytes, remainingScan.groups.length), actualBytes + reclaimed);
      // A completed batch uses one sound; no per-file or delayed second sound.
    } catch (error) {
      if (generation !== operationGeneration.current) return;
      setNeedsRescan(true);
      setStatus(error instanceof DOMException && error.name === "AbortError"
        ? t("伺服器回應逾時；為避免重複操作，請按「重新掃描」確認 Google Drive 最新狀態")
        : error instanceof Error ? error.message : t("清理未完成"));
      play("error");
    } finally {
      if (generation === operationGeneration.current && targetMode === "trash" && restorable.length) setUndoBatch({ items: restorable, groups: scan?.groups ?? [], expiresAt: Date.now() + 10_000 });
      busyRef.current = false;
      setRunning(false);
    }
  }

  async function undoTrash(): Promise<void> {
    if (!undoBatch || running || busyRef.current || undoSeconds <= 0) return;
    busyRef.current = true;
    const generation = operationGeneration.current;
    const items = undoBatch.items;
    const previousGroups = undoBatch.groups;
    setUndoBatch(null);
    setRunning(true);
    setProgress(4);
    setStatus((t("正在從 Google Drive 垃圾桶復原 ") + (items.length.toLocaleString()) + t(" 個項目")));
    let restoredBytes = 0;
    let restoredCount = 0;
    let failures = 0;
    const restored = new Map<string, AuditOutcome>();
    try {
      for (let index = 0; index < items.length; index += MUTATION_BATCH_SIZE) {
        if (generation !== operationGeneration.current) return;
        const chunk = items.slice(index, index + MUTATION_BATCH_SIZE);
        const { response, body } = await readJsonWithTimeout("/api/google/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: chunk.map((record) => ({ id: record.id, proof: record.proof })) }),
        }, OPERATION_TIMEOUT_MS);
        if (generation !== operationGeneration.current) return;
        if (!response.ok) throw new Error(errorMessage(body, t("快速復原失敗")));
        if (!isObject(body) || !Array.isArray(body.outcomes) || !body.outcomes.every(isAuditOutcome)) throw new Error(t("Google Drive 回傳了無效的復原結果"));
        const outcomes = body.outcomes;
        if (!hasCompleteOutcomes(chunk.map((record) => record.id), outcomes, "restore")) throw new Error(t("復原回報不完整，請至 Google Drive 確認"));
        setAudit((current) => [...current, ...outcomes]);
        for (const outcome of outcomes) {
          if (outcome.status === "restored") { restoredCount += 1; restoredBytes += outcome.size; restored.set(outcome.id, outcome); }
          else failures += 1;
        }
        setProgress(Math.min(100, (index + chunk.length) / items.length * 100));
      }
      setStatus(failures ? (t("已復原 ") + (restoredCount.toLocaleString()) + t(" 個項目；") + (failures.toLocaleString()) + t(" 個項目請至 Google Drive 垃圾桶確認")) : (t("已復原 ") + (restoredCount.toLocaleString()) + t(" 個項目；已更新群組，不需等待完整掃描。復原項目不會自動勾選")));
      play(failures ? "error" : "success");
      setRunning(false);
    } catch (error) {
      if (generation !== operationGeneration.current) return;
      setStatus(error instanceof Error ? error.message : t("快速復原失敗；請至 Google Drive 垃圾桶手動復原"));
      play("error");
      setRunning(false);
    } finally {
      // Restore only API-confirmed items. Never reuse a stale mutation proof.
      if (generation === operationGeneration.current) setActualBytes((value) => Math.max(0, value - restoredBytes));
      if (generation === operationGeneration.current && restored.size) setScan((current) => {
        if (!current) return current;
        const groups = new Map(current.groups.map((group) => [groupKey(group), group]));
        for (const original of previousGroups) {
          const additions = original.records.filter((record) => restored.has(record.id)).map((record) => {
            const outcome = restored.get(record.id)!;
            return { ...record, proof: outcome.refreshedProof ?? "", version: outcome.refreshedVersion ?? record.version,
              canTrash: Boolean(outcome.refreshedProof) && record.canTrash, canDelete: Boolean(outcome.refreshedProof) && record.canDelete, autoSelectable: false };
          });
          if (!additions.length) continue;
          const existing = groups.get(groupKey(original));
          const records = [...(existing?.records ?? original.records.filter((record) => record.keeper)), ...additions];
          const unique = [...new Map(records.map((record) => [record.id, record])).values()];
          groups.set(groupKey(original), { ...original, records: unique, reclaimableBytes: unique.filter((record) => !record.keeper).reduce((sum, record) => sum + record.size, 0) });
        }
        const values = [...groups.values()];
        return sortScanResult({ ...current, groups: values, duplicateCopies: values.reduce((sum, group) => sum + group.records.length - 1, 0), reclaimableBytes: values.reduce((sum, group) => sum + group.reclaimableBytes, 0) });
      });
      busyRef.current = false;
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
    await clearDriveIndex(true, true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setConnected(false); setAccount(null); setScan(null); setSelected(new Set()); setProgress(0); setStatus(t("已中斷 Google Drive 連線"));
  }

  if (checking) return <div className="cleaner-loading"><LoaderCircle className="animate-spin" size={42} aria-hidden="true" /><span>{t("正在確認安全連線")}</span></div>;

  return (
    <div className="cleaner-app">
      <ol className="flow-steps" aria-label={t("清理流程")}>
        {[t("登入"), t("掃描"), t("檢查"), t("清理")].map((label, index) => <li key={label} className={connected && index === 0 ? "done" : scan && index < 3 ? "done" : running && index === 3 ? "active" : ""}><span>{index + 1}</span><b>{label}</b></li>)}
      </ol>
      <section className="cleaner-statusbar">
        <div className="cleaner-actions">
          {!connected ? <a className={`button primary ${configured ? "" : "disabled"}`} aria-disabled={!configured} href={configured ? (locale === "en" ? "/api/google/start?lang=en" : "/api/google/start") : "#oauth-setup"}><LogIn size={17} aria-hidden="true" />{configured ? t("使用 Google 登入") : t("Google 登入設定中")}</a> : <>
            <button className="button primary" onClick={startScan} disabled={running}><ScanSearch size={17} aria-hidden="true" />{scan ? t("重新掃描") : t("開始掃描")}</button>
            <button className="text-button" disabled={running} onClick={async () => { await clearDriveIndex(true); setStatus(t("已清除這個瀏覽器的加速索引；下次掃描會重新讀取完整清單")); }}>{t("清除掃描快取")}</button>
            <button className="text-button" onClick={disconnect} disabled={running}>{t("中斷連線")}</button>
          </>}
        </div>
        <div className="account">
          {account?.photoLink ? <img src={account.photoLink} alt={("" + (account.displayName ?? "Google") + t(" 帳號頭像"))} referrerPolicy="no-referrer" /> : <span className={`account-dot ${connected ? "online" : ""}`} />}{/* eslint-disable-line @next/next/no-img-element */}
          <div><b>{account?.displayName ?? (connected ? t("Google Drive 已連線") : t("尚未連線"))}</b><small>{account?.emailAddress ?? t("登入帳號顯示於此")}</small></div>
        </div>
      </section>
      {scan && <motion.div className="scan-insights" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      <section className={`health-panel ${healthState.level}`} aria-label={t("空間整理評分")}>
        <div className="health-score-ring">
          <svg viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="47" /><motion.circle cx="54" cy="54" r="47" pathLength={100} strokeDasharray="100" initial={{ strokeDashoffset: 100 }} animate={{ strokeDashoffset: 100 - (healthScore ?? 0) }} transition={{ duration: reducedMotion ? 0 : .8, ease: "easeOut" }} /></svg>
          <div><strong><AnimatedNumber value={healthScore ?? 0} /></strong>{healthScore !== null && <small>/100</small>}</div>
        </div>
        <div className="health-copy"><span><HealthIcon size={18} aria-hidden="true" />{t(healthState.label)}</span><h2>{healthScore === null ? t("掃描後建立空間整理評分") : t("掃描結果，現在一目了然")}</h2><p>{t(healthState.detail)}{locale === "en" ? ". " : "。"}{healthScore === null ? t("尚未分析 Google Drive，不顯示推測分數。") : t("依重複容量連續配分，1 MiB 內至少 95 分；2–4 GiB 平滑降至 20 分。這是整理參考，不是磁碟健康診斷，垃圾桶仍占用空間。")}</p></div>
        <div className="health-summary"><span>{t("目前重複容量")}</span><b><AnimatedNumber value={metrics.duplicateBytes} format={formatBytes} /></b><small>{scan ? ("" + (scan.groups.length.toLocaleString()) + t(" 個重複群組")) : t("完成掃描後顯示")}</small></div>
      </section>

      <section className="metric-grid">
        <article><span>{t("預估可整理容量")}</span><strong><AnimatedNumber value={metrics.duplicateBytes} format={formatBytes} /></strong><small>{t("已確認移除副本")}<AnimatedNumber value={actualBytes} format={formatBytes} /> {t("· 垃圾桶仍占空間")}</small></article>
        <article><span>{t("重複容量百分比")}</span><strong>{reclaimPercent === null ? "—" : <AnimatedNumber value={reclaimPercent} format={(value) => `${value.toFixed(1)}%`} />}</strong><small>{t("全體重複容量 ÷ 已比對容量")}{formatBytes(scan.examinedBytes ?? 0)}</small></article>
        <article><span>{t("雲端容量占比")}</span><strong>{quotaPercent === null ? "—" : <AnimatedNumber value={quotaPercent} format={(value) => `${value.toFixed(3)}%`} />}</strong><small>{quotaLimit ? (t("雲端總容量 ") + (formatBytes(quotaLimit)) + "") : t("Google 未提供容量上限")}</small></article>
      </section>

      <section className="insight-grid" aria-label={t("長期儲存整理工具")}>
        <article className="trend-card"><div className="insight-heading"><TrendingUp size={18} aria-hidden="true" /><span><b>{t("儲存健康趨勢")}</b><small>{t("僅儲存本機彙總分數")}</small></span></div><div className="trend-bars" aria-label={t("最近健康評分")}>
          {(healthHistory.length ? healthHistory : [{ timestamp: "", score: healthScore ?? 0, reclaimedBytes: actualBytes }]).map((item, index) => <i key={`${item.timestamp}-${index}`} style={{ height: `${Math.max(12, item.score)}%` }} title={healthScore === null && !healthHistory.length ? t("尚未掃描") : `${item.score}/100`} />)}
        </div></article>
        <article><div className="insight-heading"><Cloud size={18} aria-hidden="true" /><span><b>{t("容量費用等值估算")}</b><small>{t("參考：100 GB／NT$65 每月，可依帳單調整")}</small></span></div><details className="roi-plan-editor"><summary>{t("調整參考方案")}</summary><div className="roi-fields"><label>{t("方案")}<select value={planProvider} onChange={(event) => { setPlanProvider(event.target.value); localStorage.setItem("dupespace-roi-plan-v2", JSON.stringify({ provider: event.target.value, price: planPrice, capacityGb: planCapacityGb })); }}><option>Google One</option><option>iCloud+</option><option>{t("自訂方案")}</option></select></label><label>{t("每月費用")}<input type="number" min="0" value={planPrice} onChange={(event) => { const value = Math.max(0, Number(event.target.value)); setPlanPrice(value); localStorage.setItem("dupespace-roi-plan-v2", JSON.stringify({ provider: planProvider, price: value, capacityGb: planCapacityGb })); }} /></label><label>{t("方案容量 GB")}<input type="number" min="1" value={planCapacityGb} onChange={(event) => { const value = Math.max(1, Number(event.target.value)); setPlanCapacityGb(value); localStorage.setItem("dupespace-roi-plan-v2", JSON.stringify({ provider: planProvider, price: planPrice, capacityGb: value })); }} /></label></div></details><strong className="roi-value">{t("約 NT$")}<AnimatedNumber value={roiEstimate} format={(value) => value > 0 && value < .01 ? "< 0.01" : value.toFixed(2)} />{t("／月容量等值")}</strong><small className="profile-note">{t("以本次已整理＋仍可整理容量按方案單價換算，不代表帳單折扣。垃圾桶清空前不會釋放配額。參考價來自")}<a href="https://www.cht.com.tw/home/campaign/googleone/index.html?zone=4" target="_blank" rel="noreferrer">{t("台灣供應商")}</a>{t("，實際價格依帳單。")}</small></article>
        <article><div className="insight-heading"><ShieldCheck size={18} aria-hidden="true" /><span><b>{t("防護設定檔")}</b><small>{t("偏好只保存在這個瀏覽器")}</small></span></div><label className="profile-select">{t("整理情境")}<select value={profile} onChange={(event) => { setProfile(event.target.value); localStorage.setItem("dupespace-protected-profile", event.target.value); setScan(null); setSelected(new Set()); setStatus(t("防護設定檔已變更，請重新掃描")); }}><option value="project">{t("軟體專案保護")}</option><option value="media">{t("影音備份保護")}</option><option value="strict">{t("嚴格保護")}</option></select></label><small className="profile-note">{t("軟體專案模式預選符合門檻的檔案與鏡像資料夾；影音備份模式不預選資料夾；嚴格模式不自動預選。硬性排除永遠有效。")}</small></article>
        <article><div className="insight-heading"><FolderTree size={18} aria-hidden="true" /><span><b>{t("重複成因分析")}</b><small>{t("依檔案路徑線索推估")}</small></span></div><div className="cause-list">{[[t("下載項目"), causes.download], [t("通訊軟體"), causes.messaging], [t("跨資料夾複製"), causes.copied], [t("其他"), causes.other]].map(([label, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Math.max(4, Number(value) / Math.max(1, records.length) * 100)}%` }} /></i><strong>{value}</strong></div>)}</div></article>
      </section>

      </motion.div>}

      <section className="animated-progress" aria-live="polite">
        <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
        <div className={`progress-track ${running ? "running" : ""}`}><i style={{ width: `${progress}%` }} /></div>
        {running && <button className="text-button" onClick={() => { cancelRef.current = true; scanController.current?.abort(); setStatus(t("將在目前批次完成後安全停止")); }}><Square size={13} aria-hidden="true" />{t("安全停止")}</button>}
      </section>

      {scan && <>
        <section className="mode-section" aria-labelledby="mode-title">
          <div><span className="eyebrow"><ShieldCheck size={14} aria-hidden="true" /> {t("步驟 4")}</span><h2 id="mode-title">{t("選擇處理方式")}</h2><p>{t("檔案與完整鏡像資料夾都可移至垃圾桶；資料夾永遠不能永久刪除。垃圾桶失敗絕不會自動改成永久刪除。")}</p></div>
          <div className="mode-options">
            <label htmlFor="mode-trash" className={`mode-card recommended ${mode === "trash" ? "selected" : ""}`}><span className="sr-only">{t("選擇移至垃圾桶")}</span><input id="mode-trash" aria-label={t("移至垃圾桶")} type="radio" name="mode" checked={mode === "trash"} onChange={() => chooseMode("trash")} disabled={running} /><span className="mode-copy"><span className="mode-heading"><b>{t("移至垃圾桶")}</b><em>{t("建議")}</em></span><small>{t("預設、建議。仍可從 Google Drive 垃圾桶復原。")}</small></span></label>
            <label htmlFor="mode-permanent" className={`mode-card high-risk ${mode === "permanent" ? "selected" : ""}`}><span className="sr-only">{t("選擇立即永久刪除")}</span><input id="mode-permanent" aria-label={t("立即永久刪除")} type="radio" name="mode" checked={mode === "permanent"} onChange={() => chooseMode("permanent")} disabled={running} /><span className="mode-copy"><span className="mode-heading"><b>{t("立即永久刪除")}</b><em>{t("無法復原")}</em></span><small>{t("高風險進階功能，刪除後沒有任何復原方式。")}</small></span></label>
          </div>
        </section>
        <div className="results-toolbar">
          <div><b>{scan.groups.length.toLocaleString()} {t("組 ·")}{scan.duplicateCopies.toLocaleString()} {t("個重複副本")}</b><span>{t("掃描")}{scan.examined.toLocaleString()} {t("個項目，略過")}{scan.skipped.toLocaleString()} {t("個不適用項目；其中")}{scan.projectProtected.toLocaleString()} {t("個專案項目受到硬性保護")}</span></div>
          <div><button className="text-button" onClick={() => setSelected(new Set(records.filter((record) => selectable(record)).map((record) => record.id)))} disabled={running || needsRescan}>{t("選取全部重複副本")}</button><button className="text-button" onClick={() => setSelected(new Set())} disabled={running}>{t("清除選取")}</button></div>
        </div>
        {!!scan.groups.length && <nav className="category-filter" aria-label={t("依檔案類型篩選重複群組")}>
          <button className={category === "all" ? "active" : ""} onClick={() => { setCategory("all"); setVisibleGroups(18); }}><Layers3 size={17} aria-hidden="true" /><span>{t("全部")}</span><b>{scan.groups.length.toLocaleString()}</b></button>
          {CATEGORY_ORDER.filter((item) => categoryCounts[item] > 0).map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setVisibleGroups(18); }}><CategoryIcon category={item} /><span>{t(CATEGORY_LABELS[item])}</span><b>{categoryCounts[item].toLocaleString()}</b></button>)}
        </nav>}
        {!scan.groups.length && <div className="empty-state"><ShieldCheck size={36} aria-hidden="true" /><h3>{t("目前很乾淨")}</h3><p>{t("沒有找到可安全比對的重複檔案或完整鏡像資料夾。")}</p></div>}
        <div className="group-list">
          {filteredGroups.slice(0, visibleGroups).map((group) => {
            const key = groupKey(group);
            const limit = recordLimits[key] ?? 40;
            const expanded = expandedGroups.has(key);
            const keeper = group.records.find((record) => record.keeper) ?? group.records[0];
            const copies = group.records.filter((record) => !record.keeper);
            const itemCategory = groupCategory(group);
            return <article className={`duplicate-group category-${itemCategory}`} key={key}>
              <button className="group-summary" type="button" aria-expanded={expanded} onClick={() => setExpandedGroups((current) => current.has(key) ? new Set() : new Set([key]))}>
                {itemCategory === "image" || itemCategory === "video" || itemCategory === "pdf" ? <GroupThumbnail key={`${keeper.id}:${keeper.version}`} url={keeper.thumbnailLink} id={keeper.id} proof={keeper.proof} name={keeper.name} video={itemCategory === "video"} document={itemCategory === "pdf"} /> : <span className="category-badge"><CategoryIcon category={itemCategory} /><b>{t(CATEGORY_LABELS[itemCategory])}</b></span>}
                <span className="group-title"><b>{keeper?.name ?? t("未命名項目")}</b><small>{t(CATEGORY_LABELS[itemCategory])} · {copies.length.toLocaleString()} {t("個重複副本")}{group.itemKind === "folder" ? (" · " + (group.tree.length.toLocaleString()) + t(" 個檔案 100% 鏡像")) : ""}</small></span>
                <span className="group-saving"><small>{t("可整理")}</small><strong>{formatBytes(group.reclaimableBytes)}</strong></span>
                <ChevronDown className="group-chevron" size={20} aria-hidden="true" />
              </button>
              {expanded && <div className="group-body">
                {group.itemKind === "folder" && <div className="folder-match-banner"><span><CheckCircle2 size={15} aria-hidden="true" />{t("100% 鏡像對齊")}</span><b>{group.tree.length.toLocaleString()} {t("個檔案，完整路徑、大小與校驗碼一致")}</b><button className="text-button" onClick={() => { setTreeDrawer(group); setTreeLimit(200); }}><FolderTree size={16} aria-hidden="true" />{t("開啟雙樹比對")}</button></div>}
                <div className="group-comparison">
                  <aside className="keeper-preview">
                    <div className="keeper-visual">
                      {keeper?.thumbnailLink ? <GroupThumbnail key={`${keeper.id}:${keeper.version}:large`} url={keeper.thumbnailLink} id={keeper.id} proof={keeper.proof} name={keeper.name} video={itemCategory === "video"} document={itemCategory === "pdf"} /> : <CategoryIcon category={itemCategory} size={46} />}{ }
                      <span><ShieldCheck size={15} aria-hidden="true" />{t("受保護原始檔")}</span>
                    </div>
                    <b>{keeper?.name}</b>
                    <p>{keeper?.path}</p>
                    <small>{keeper ? formatBytes(keeper.size) : ""}{keeper?.modifiedTime ? ` · ${new Date(keeper.modifiedTime).toLocaleString(locale)}` : ""}</small>
                    {keeper?.webViewLink && <a href={keeper.webViewLink} target="_blank" rel="noreferrer"><Eye size={15} aria-hidden="true" />{t("在 Google Drive 預覽")}</a>}
                  </aside>
                  <div className="copy-panel">
                    <div className="copy-panel-heading"><span><Trash2 size={17} aria-hidden="true" />{t("待處理副本")}</span><small>{t("副本內容與左側保留檔一致，不重複下載縮圖")}</small></div>
                    <div className="record-list">
                      {copies.slice(0, limit).map((record) => <label className={`record ${selected.has(record.id) ? "selected" : ""}`} key={record.id}>
                        <input type="checkbox" checked={selected.has(record.id)} disabled={!selectable(record) || running} onChange={() => toggle(record)} />
                        <span className="record-name"><b>{record.name}</b><small className="record-path">{record.path}</small><small>{record.itemKind === "folder" ? ("" + (record.entryCount.toLocaleString()) + t(" 個可比對檔案") + (record.ignoredMetadataCount ? (t(" · 忽略 ") + (record.ignoredMetadataCount) + t(" 個暫存檔")) : "") + "") : record.modifiedTime ? new Date(record.modifiedTime).toLocaleString(locale) : t("日期不明")}{record.webViewLink ? <> · <a href={record.webViewLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Eye size={13} aria-hidden="true" />{t("在 Drive 預覽")}</a></> : null}</small></span>
                        <span className="record-size">{formatBytes(record.size)}</span>
                        <span className={`record-state ${!selectable(record) ? "locked" : ""}`}>{mode === "permanent" && record.itemKind === "folder" ? t("僅限垃圾桶") : !selectable(record) ? t("無權限") : selected.has(record.id) ? (mode === "trash" ? t("垃圾桶") : t("永久刪除")) : t("略過")}</span>
                        {lastOutcomes[record.id] && <span className="record-outcome"><AlertCircle size={15} aria-hidden="true" />{t("未處理：")}{lastOutcomes[record.id].reason}</span>}
                      </label>)}
                      {copies.length > limit && <button className="load-more" onClick={() => setRecordLimits((current) => ({ ...current, [key]: limit + 80 }))}>{t("再顯示")}{Math.min(80, copies.length - limit)} {t("個副本")}</button>}
                    </div>
                  </div>
                </div>
              </div>}
            </article>;
          })}
        </div>
        {filteredGroups.length > visibleGroups && <button className="load-more" onClick={() => setVisibleGroups((value) => value + 18)}>{t("載入更多重複群組")}</button>}
        <div className={`trash-dock ${mode === "permanent" ? "permanent" : ""}`}><div><span>{t("已選")}{selected.size.toLocaleString()} {t("個副本 ·")}{scan.groups.length.toLocaleString()} {t("個群組")}</span><strong>{t("可整理")}{formatBytes(selectedBytes)}</strong></div><div className="dock-actions">{audit.length > 0 && <button className="button secondary" onClick={downloadCsv}><Download size={16} aria-hidden="true" />{t("下載 CSV 稽核報告")}</button>}{needsRescan ? <button className="button primary" onClick={startScan} disabled={running}><ScanSearch size={17} aria-hidden="true" />{t("重新掃描未處理項目")}</button> : <button className={`button ${mode === "trash" ? "primary" : "danger"}`} onClick={requestOperation} disabled={!selected.size || running}>{mode === "trash" ? <><Trash2 size={17} aria-hidden="true" />{t("移至 Google Drive 垃圾桶")}</> : <><AlertTriangle size={17} aria-hidden="true" />{t("立即永久刪除（無法復原）")}</>}</button>}</div></div>
      </>}

      {treeDrawer && (() => {
        const keeper = treeDrawer.records.find((record) => record.keeper) as DriveRecord;
        const target = treeDrawer.records.find((record) => !record.keeper) as DriveRecord;
        return <div className="tree-drawer-backdrop">
          <aside className="tree-drawer" role="dialog" aria-modal="true" aria-labelledby="tree-drawer-title">
            <button className="modal-close" aria-label={t("關閉資料夾比對")} onClick={() => setTreeDrawer(null)}><X size={18} aria-hidden="true" /></button>
            <span className="eyebrow"><FolderTree size={14} aria-hidden="true" /> SIDE-BY-SIDE TREE DIFF</span>
            <h2 id="tree-drawer-title">{t("保留目錄與待清目錄")}</h2>
            <div className="mirror-score"><span><CheckCircle2 size={20} aria-hidden="true" /></span><div><b>{t("100% 鏡像對齊")}</b><small>{treeDrawer.tree.length.toLocaleString()} {t("個檔案的相對路徑、大小與內容校驗碼完全一致")}</small></div></div>
            <div className="tree-paths"><div><span>{t("保留目錄")}</span><b>{keeper.path}</b></div><div><span>{t("待清目錄")}</span><b>{target.path}</b></div></div>
            <div className="tree-columns" aria-label={t("資料夾檔案樹對照")}>
              {[keeper, target].map((record) => <div key={record.id}><h3>{record.keeper ? t("受保護 · 永遠保留") : t("待清理 · 移至垃圾桶")}</h3>{treeDrawer.tree.slice(0, treeLimit).map((entry) => <div className="tree-entry" key={`${record.id}-${entry.relativePath}`}><span>{entry.relativePath}</span><small>{formatBytes(entry.size)}</small></div>)}</div>)}
            </div>
            {treeDrawer.tree.length > treeLimit && <button className="load-more" onClick={() => setTreeLimit((value) => value + 400)}>{t("再顯示")}{Math.min(400, treeDrawer.tree.length - treeLimit).toLocaleString()} {t("個檔案")}</button>}
          </aside>
        </div>;
      })()}

      {confirmation && <div className="modal-backdrop" role="presentation" onKeyDown={(event) => { if (event.key === "Escape") setConfirmation(null); if (confirmation.mode === "permanent" && event.key === "Enter") event.preventDefault(); }}>
        <section className={`confirm-modal ${confirmation.mode === "permanent" ? "permanent" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <button className="modal-close" aria-label={t("取消")} onClick={() => setConfirmation(null)}><X size={18} aria-hidden="true" /></button>
          <span className="warning-icon">{confirmation.mode === "trash" ? <Trash2 size={26} aria-hidden="true" /> : <AlertTriangle size={26} aria-hidden="true" />}</span>
          <p className="confirm-kicker">{confirmation.stage === 2 ? t("第二層安全確認") : confirmation.mode === "trash" ? t("一般確認") : t("高風險功能")}</p>
          <h2 id="confirm-title">{confirmation.mode === "trash" ? t("移至 Google Drive 垃圾桶？") : t("永久刪除，沒有復原功能")}</h2>
          <p>{confirmation.mode === "trash" ? t("選取檔案會移至垃圾桶，仍可依 Google Drive 的保留政策復原。") : t("這不是清空垃圾桶；選取檔案會立即從 Google Drive 永久消失。")}</p>
          <dl className="confirm-summary"><div><dt>{t("選取數量")}</dt><dd>{confirmation.records.length.toLocaleString()} {t("個檔案")}</dd></div><div><dt>{t("重複群組")}</dt><dd>{new Set(confirmation.records.map((record) => scan?.groups.findIndex((group) => group.records.some((item) => item.id === record.id)))).size.toLocaleString()} {t("組")}</dd></div><div><dt>{t("預計釋放")}</dt><dd>{formatBytes(confirmation.records.reduce((sum, record) => sum + record.size, 0))}</dd></div><div><dt>{t("掃描位置")}</dt><dd>{t("我的 Google Drive")}</dd></div><div><dt>{t("處理方式")}</dt><dd>{confirmation.mode === "trash" ? t("移至垃圾桶（可復原）") : t("永久刪除（無法復原）")}</dd></div></dl>
          <label className="risk-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>{t("我了解以上重複檔案會永久刪除，並自負檔案遺失責任。")}</span></label>
          {largeRisk && <div className="countdown-warning"><b>{t("大量永久刪除保護")}</b><span>{t("完整摘要已顯示。")}{countdown > 0 ? (t("請等待 ") + (countdown) + t(" 秒")) : t("等待完成，請再次核對內容")}</span></div>}
          <div className="modal-actions"><button className="button secondary" onClick={() => setConfirmation(null)}>{t("取消，保留檔案")}</button><button className="button danger" onClick={acceptConfirmation} disabled={!acknowledged || countdown > 0}>{t("確認永久刪除（無法復原）")}</button></div>
        </section>
      </div>}
      {undoBatch && <motion.aside className="undo-toast" role="status" aria-live="polite" initial={reducedMotion ? false : { opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="undo-copy"><CheckCircle2 size={20} aria-hidden="true" /><span><b>{t("已移至 Google Drive 垃圾桶")}</b><small>{t("共")}{undoBatch.items.length.toLocaleString()} {t("個項目，可在")}{undoSeconds} {t("秒內快速復原")}</small></span></div>
        <button type="button" onClick={undoTrash} disabled={running || undoSeconds <= 0}><RotateCcw size={16} aria-hidden="true" />{t("復原")}</button>
        <i aria-hidden="true"><motion.span initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: reducedMotion ? 0 : 10, ease: "linear" }} /></i>
      </motion.aside>}
    </div>
  );
}
