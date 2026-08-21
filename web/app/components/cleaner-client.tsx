"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  operationMode: OperationMode;
  status: string;
  reason: string;
  itemKind: "file" | "folder";
};
type Confirmation = {
  mode: OperationMode;
  records: DriveRecord[];
  stage: 1 | 2;
};

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
  const cancelRef = useRef(false);

  useEffect(() => {
    fetch("/api/google/status", { cache: "no-store" })
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
    if (!confirmation || confirmation.stage !== 2 || confirmation.mode !== "permanent" || countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => {
      if (value <= 1) { window.clearInterval(timer); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [confirmation, countdown]);

  const records = useMemo(() => scan?.groups.flatMap((group) => group.records) ?? [], [scan]);
  const selectedRecords = useMemo(() => records.filter((record) => selected.has(record.id)), [records, selected]);
  const selectedBytes = selectedRecords.reduce((total, record) => total + record.size, 0);
  const quotaLimit = Number(scan?.storageQuota?.limit ?? 0);
  const reclaimPercent = percent(selectedBytes, scan?.reclaimableBytes ?? 0);
  const quotaPercent = percent(selectedBytes, quotaLimit);
  const expectedPhrase = confirmation ? `永久刪除 ${confirmation.records.length} 個檔案` : "";
  const needsSecond = confirmation ? confirmation.records.length > 5 : false;
  const largeRisk = confirmation ? confirmation.records.length >= 500 || confirmation.records.reduce((sum, item) => sum + item.size, 0) >= GIB || confirmation.records.length >= 5000 : false;

  function play(kind: Parameters<typeof synthSound>[0]): void {
    synthSound(kind, DEFAULT_SOUND_VOLUME);
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
        body: JSON.stringify({ ignoreSystemMetadata }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body, "掃描失敗"));
      if (!isScanResult(body)) throw new Error("Google Drive 回傳了無效的掃描資料");
      setScan(body);
      setAccount(body.user);
      setMode("trash");
      setSelected(new Set(body.groups.flatMap((group: DriveGroup) => group.records
        .filter((record) => !record.keeper && record.canTrash && record.autoSelectable)
        .map((record) => record.id))));
      setStatus(body.duplicateCopies
        ? `掃描完成：找到 ${body.duplicateCopies.toLocaleString()} 個重複檔案或資料夾副本`
        : "掃描完成，目前沒有內容完全相同的檔案或資料夾");
      setProgress(100);
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
        for (const outcome of outcomes) {
          if (outcome.status === "trashed" || outcome.status === "deleted") {
            reclaimed += outcome.size;
            setSelected((current) => { const next = new Set(current); next.delete(outcome.id); return next; });
          } else failures += 1;
        }
        if (successfulIds.size) {
          setScan((current) => current ? removeSuccessfulRecords(current, successfulIds) : current);
        }
        completed += chunk.length;
        setActualBytes((value) => value + outcomes.filter((item) => item.status === "trashed" || item.status === "deleted").reduce((sum, item) => sum + item.size, 0));
        setProgress(completed / items.length * 100);
      }
      setStatus(cancelRef.current
        ? `已安全停止；本次已處理 ${formatBytes(reclaimed)}`
        : `完成：Google Drive 已確認移除 ${formatBytes(reclaimed)}${failures ? `，${failures} 個檔案因安全檢查未處理` : ""}`);
      play(failures ? "error" : targetMode === "trash" ? "trash" : "deleted");
      if (!failures && !cancelRef.current) window.setTimeout(() => play("success"), 380);
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError"
        ? "伺服器回應逾時；為避免重複操作，請按「重新掃描」確認 Google Drive 最新狀態"
        : error instanceof Error ? error.message : "清理未完成");
      play("error");
    } finally { setRunning(false); }
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

  if (checking) return <div className="cleaner-loading"><i /><span>正在確認安全連線…</span></div>;

  return (
    <div className="cleaner-app">
      <ol className="flow-steps" aria-label="清理流程">
        {["登入", "掃描", "檢查", "清理"].map((label, index) => <li key={label} className={connected && index === 0 ? "done" : scan && index < 3 ? "done" : running && index === 3 ? "active" : ""}><span>{index + 1}</span><b>{label}</b></li>)}
      </ol>
      <section className="cleaner-statusbar">
        <div className="cleaner-actions">
          {!connected ? <a className={`button primary ${configured ? "" : "disabled"}`} aria-disabled={!configured} href={configured ? "/api/google/start" : "#oauth-setup"}>{configured ? "使用 Google 登入" : "Google 登入設定中"}</a> : <>
            <button className="button primary" onClick={startScan} disabled={running}>{scan ? "重新掃描" : "開始掃描"}</button>
            <button className="text-button" onClick={disconnect} disabled={running}>中斷連線</button>
          </>}
        </div>
        <div className="account">
          {account?.photoLink ? <img src={account.photoLink} alt="" referrerPolicy="no-referrer" /> : <span className={`account-dot ${connected ? "online" : ""}`} />}{/* eslint-disable-line @next/next/no-img-element */}
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
        <span><b>進階：忽略系統暫存檔</b><small>預設關閉。開啟後，.DS_Store、Thumbs.db、desktop.ini 不參與資料夾鏡像比對；移除資料夾時仍會一併進垃圾桶。</small></span>
      </label>

      <section className="metric-grid">
        <article><span>預估節省容量</span><strong>{formatBytes(selectedBytes)}</strong><small>實際已釋放 {formatBytes(actualBytes)}</small></article>
        <article><span>重複容量百分比</span><strong>{reclaimPercent.toFixed(1)}%</strong><small>{selected.size.toLocaleString()} 個已選副本</small></article>
        <article><span>磁碟容量占比</span><strong>{quotaLimit ? `${quotaPercent.toFixed(3)}%` : "—"}</strong><small>{quotaLimit ? `雲端總容量 ${formatBytes(quotaLimit)}` : "Google 未提供容量上限"}</small></article>
      </section>

      <section className="animated-progress" aria-live="polite">
        <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
        <div className={`progress-track ${running ? "running" : ""}`}><i style={{ width: `${progress}%` }} /></div>
        {running && <button className="text-button" onClick={() => { cancelRef.current = true; setStatus("將在目前批次完成後安全停止…"); }}>安全停止</button>}
      </section>

      {scan && <>
        <section className="mode-section" aria-labelledby="mode-title">
          <div><span className="eyebrow"><i /> 步驟 4</span><h2 id="mode-title">選擇處理方式</h2><p>檔案與完整鏡像資料夾都可移至垃圾桶；資料夾永遠不能永久刪除。垃圾桶失敗絕不會自動改成永久刪除。</p></div>
          <div className="mode-options">
            <label htmlFor="mode-trash" className={`mode-card recommended ${mode === "trash" ? "selected" : ""}`}><span className="sr-only">選擇移至垃圾桶</span><input id="mode-trash" aria-label="移至垃圾桶" type="radio" name="mode" checked={mode === "trash"} onChange={() => chooseMode("trash")} disabled={running} /><span><b>移至垃圾桶</b><small>預設、建議。仍可從 Google Drive 垃圾桶復原。</small><em>建議</em></span></label>
            <label htmlFor="mode-permanent" className={`mode-card high-risk ${mode === "permanent" ? "selected" : ""}`}><span className="sr-only">選擇立即永久刪除</span><input id="mode-permanent" aria-label="立即永久刪除" type="radio" name="mode" checked={mode === "permanent"} onChange={() => chooseMode("permanent")} disabled={running} /><span><b>立即永久刪除</b><small>高風險進階功能，刪除後沒有任何復原方式。</small><em>無法復原</em></span></label>
          </div>
        </section>
        <div className="results-toolbar">
          <div><b>{scan.groups.length.toLocaleString()} 組 · {scan.duplicateCopies.toLocaleString()} 個重複副本</b><span>掃描 {scan.examined.toLocaleString()} 個項目，略過 {scan.skipped.toLocaleString()} 個不適用項目；其中 {scan.projectProtected.toLocaleString()} 個專案項目受到硬性保護</span></div>
          <div><button className="text-button" onClick={() => setSelected(new Set(records.filter((record) => selectable(record)).map((record) => record.id)))} disabled={mode === "permanent"}>選取全部重複副本</button><button className="text-button" onClick={() => setSelected(new Set())}>清除選取</button></div>
        </div>
        {!scan.groups.length && <div className="empty-state"><span>✦</span><h3>目前很乾淨</h3><p>沒有找到可安全比對的重複檔案或完整鏡像資料夾。</p></div>}
        <div className="group-list">
          {scan.groups.slice(0, visibleGroups).map((group, groupIndex) => {
            const key = `${group.fingerprint}-${groupIndex}`;
            const limit = recordLimits[key] ?? 80;
            return <details className="duplicate-group" key={key} open={groupIndex < 3}>
              <summary><span><b>{group.itemKind === "folder" ? "重複資料夾" : "重複檔案"}群組 {groupIndex + 1}</b><small>{group.records.length.toLocaleString()} 份相同內容{group.itemKind === "folder" ? ` · ${group.tree.length.toLocaleString()} 個檔案 100% 鏡像對齊` : ""}</small></span><strong>{formatBytes(group.reclaimableBytes)}</strong></summary>
              {group.itemKind === "folder" && <div className="folder-match-banner"><span>✓ 100% 鏡像對齊</span><b>{group.tree.length.toLocaleString()} 個檔案，完整路徑、大小與校驗碼一致</b><button className="text-button" onClick={() => { setTreeDrawer(group); setTreeLimit(200); }}>開啟雙樹比對</button></div>}
              <div className="record-list">
                {group.records.slice(0, limit).map((record) => <label className={`record ${record.keeper ? "keeper" : selected.has(record.id) ? "selected" : ""}`} key={record.id}>
                  <input type="checkbox" checked={!record.keeper && selected.has(record.id)} disabled={!selectable(record) || running} onChange={() => toggle(record)} />
                  <span className="file-preview">{record.thumbnailLink ? <img src={record.thumbnailLink} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span>{record.itemKind === "folder" ? "DIR" : record.name.includes(".") ? record.name.split(".").pop()?.slice(0, 4).toUpperCase() : "FILE"}</span>}</span>{/* eslint-disable-line @next/next/no-img-element */}
                  <span className="record-name"><b>{record.name}</b><small className="record-path">{record.path}</small><small>{record.itemKind === "folder" ? `${record.entryCount.toLocaleString()} 個可比對檔案${record.ignoredMetadataCount ? ` · 忽略 ${record.ignoredMetadataCount} 個暫存檔` : ""}` : record.modifiedTime ? new Date(record.modifiedTime).toLocaleString("zh-TW") : "日期不明"}{record.webViewLink ? <> · <a href={record.webViewLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>在 Drive 預覽</a></> : null}</small></span>
                  <span className="record-size">{formatBytes(record.size)}</span>
                  <span className={`record-state ${record.keeper ? "safe" : !selectable(record) ? "locked" : ""}`}>{record.keeper ? "保留" : mode === "permanent" && record.itemKind === "folder" ? "僅限垃圾桶" : !selectable(record) ? "無權限" : selected.has(record.id) ? (mode === "trash" ? "垃圾桶" : "永久刪除") : "略過"}</span>
                </label>)}
                {group.records.length > limit && <button className="load-more" onClick={() => setRecordLimits((current) => ({ ...current, [key]: limit + 160 }))}>再顯示 {Math.min(160, group.records.length - limit)} 個副本</button>}
              </div>
            </details>;
          })}
        </div>
        {scan.groups.length > visibleGroups && <button className="load-more" onClick={() => setVisibleGroups((value) => value + 24)}>載入更多重複群組</button>}
        <div className={`trash-dock ${mode === "permanent" ? "permanent" : ""}`}><div><span>已選 {selected.size.toLocaleString()} 個副本 · {scan.groups.length.toLocaleString()} 個群組</span><strong>可節省 {formatBytes(selectedBytes)} · {reclaimPercent.toFixed(1)}%</strong></div><div className="dock-actions">{audit.length > 0 && <button className="button secondary" onClick={downloadCsv}>下載 CSV 稽核報告</button>}<button className={`button ${mode === "trash" ? "primary" : "danger"}`} onClick={requestOperation} disabled={!selected.size || running}>{mode === "trash" ? "移至 Google Drive 垃圾桶" : "立即永久刪除（無法復原）"}</button></div></div>
      </>}

      {treeDrawer && (() => {
        const keeper = treeDrawer.records.find((record) => record.keeper) as DriveRecord;
        const target = treeDrawer.records.find((record) => !record.keeper) as DriveRecord;
        return <div className="tree-drawer-backdrop">
          <aside className="tree-drawer" role="dialog" aria-modal="true" aria-labelledby="tree-drawer-title">
            <button className="modal-close" aria-label="關閉資料夾比對" onClick={() => setTreeDrawer(null)}>×</button>
            <span className="eyebrow"><i /> SIDE-BY-SIDE TREE DIFF</span>
            <h2 id="tree-drawer-title">保留目錄與待清目錄</h2>
            <div className="mirror-score"><span>✓</span><div><b>100% 鏡像對齊</b><small>{treeDrawer.tree.length.toLocaleString()} 個檔案的相對路徑、大小與內容校驗碼完全一致</small></div></div>
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
          <button className="modal-close" aria-label="取消" onClick={() => setConfirmation(null)}>×</button>
          <span className="warning-icon">{confirmation.mode === "trash" ? "↙" : "!"}</span>
          <p className="confirm-kicker">{confirmation.stage === 2 ? "第二層安全確認" : confirmation.mode === "trash" ? "一般確認" : "高風險功能"}</p>
          <h2 id="confirm-title">{confirmation.mode === "trash" ? "移至 Google Drive 垃圾桶？" : "永久刪除，沒有復原功能"}</h2>
          <p>{confirmation.mode === "trash" ? "選取檔案會移至垃圾桶，仍可依 Google Drive 的保留政策復原。" : "這不是清空垃圾桶；選取檔案會立即從 Google Drive 永久消失。"}</p>
          <dl className="confirm-summary"><div><dt>選取數量</dt><dd>{confirmation.records.length.toLocaleString()} 個檔案</dd></div><div><dt>重複群組</dt><dd>{new Set(confirmation.records.map((record) => scan?.groups.findIndex((group) => group.records.some((item) => item.id === record.id)))).size.toLocaleString()} 組</dd></div><div><dt>預計釋放</dt><dd>{formatBytes(confirmation.records.reduce((sum, record) => sum + record.size, 0))}</dd></div><div><dt>掃描位置</dt><dd>我的 Google Drive</dd></div><div><dt>處理方式</dt><dd>{confirmation.mode === "trash" ? "移至垃圾桶（可復原）" : "永久刪除（無法復原）"}</dd></div></dl>
          {confirmation.mode === "permanent" && confirmation.stage === 2 && <label className="typed-confirm"><span>請完整輸入：<b>{expectedPhrase}</b></span><input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} autoComplete="off" /></label>}
          {largeRisk && confirmation.stage === 2 && <div className="countdown-warning"><b>大量永久刪除保護</b><span>完整摘要已顯示。{countdown > 0 ? `請等待 ${countdown} 秒` : "等待完成，請再次核對內容"}</span></div>}
          <div className="modal-actions"><button className="button secondary" onClick={() => setConfirmation(null)}>取消，保留檔案</button><button className={`button ${confirmation.mode === "trash" ? "primary" : "danger"}`} onClick={acceptConfirmation} disabled={confirmation.mode === "permanent" && confirmation.stage === 2 && (confirmationText !== expectedPhrase || countdown > 0)}>{confirmation.stage === 1 && (confirmation.mode === "permanent" ? needsSecond || largeRisk : needsSecond) ? "繼續安全確認" : confirmation.mode === "trash" ? "確認移至垃圾桶" : "確認永久刪除（無法復原）"}</button></div>
        </section>
      </div>}
    </div>
  );
}
