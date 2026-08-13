"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DriveRecord = {
  id: string;
  name: string;
  size: number;
  checksum: string;
  version: string;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  keeper: boolean;
  proof: string;
};

type DriveGroup = { fingerprint: string; reclaimableBytes: number; records: DriveRecord[] };
type ScanResult = {
  examined: number;
  skipped: number;
  duplicateCopies: number;
  reclaimableBytes: number;
  groups: DriveGroup[];
  storageQuota: { limit?: string; usage?: string } | null;
  user: { displayName?: string; emailAddress?: string; photoLink?: string } | null;
};

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

export function CleanerClient() {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [checking, setChecking] = useState(true);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("連接 Google Drive 後即可開始安全掃描");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [trashedBytes, setTrashedBytes] = useState(0);
  const [visibleGroups, setVisibleGroups] = useState(30);
  const [recordLimits, setRecordLimits] = useState<Record<string, number>>({});
  const cancelRef = useRef(false);

  useEffect(() => {
    fetch("/api/google/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        setConnected(Boolean(body.connected));
        setConfigured(body.configured !== false);
        if (body.configured === false) setStatus("Google OAuth 正在等待網站管理員完成啟用設定");
      })
      .catch(() => setConnected(false))
      .finally(() => setChecking(false));
  }, []);

  const records = useMemo(() => scan?.groups.flatMap((group) => group.records) ?? [], [scan]);
  const selectedRecords = useMemo(() => records.filter((record) => selected.has(record.id)), [records, selected]);
  const selectedBytes = selectedRecords.reduce((total, record) => total + record.size, 0);
  const quotaLimit = Number(scan?.storageQuota?.limit ?? 0);
  const reclaimPercent = percent(selectedBytes, scan?.reclaimableBytes ?? 0);
  const quotaPercent = percent(selectedBytes, quotaLimit);

  function animatedWait(target = 88): number {
    return window.setInterval(() => setProgress((current) => Math.min(target, current + Math.max(0.4, (target - current) * 0.06))), 180);
  }

  async function startScan() {
    setRunning(true); setProgress(2); setStatus("正在讀取 Google Drive 中的檔案與校驗碼…");
    const timer = animatedWait();
    try {
      const response = await fetch("/api/google/scan", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "掃描失敗");
      setScan(body);
      setSelected(new Set(body.groups.flatMap((group: DriveGroup) => group.records.filter((record) => !record.keeper).map((record) => record.id))));
      setStatus(`掃描完成：找到 ${body.duplicateCopies.toLocaleString()} 個可移除副本`);
      setProgress(100);
    } catch (error) {
      setProgress(0); setStatus(error instanceof Error ? error.message : "掃描失敗");
    } finally {
      window.clearInterval(timer); setRunning(false);
    }
  }

  function toggle(record: DriveRecord) {
    if (record.keeper || running) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(record.id)) next.delete(record.id); else next.add(record.id);
      return next;
    });
  }

  async function moveToTrash() {
    const count = selectedRecords.length;
    if (!count || running) return;
    if (!window.confirm(`將 ${count.toLocaleString()} 個副本移至 Google Drive 垃圾桶，預計節省 ${formatBytes(selectedBytes)}。是否繼續？`)) return;
    if (count >= 500 && window.prompt(`大量清理保護：請輸入「移除 ${count}」`) !== `移除 ${count}`) {
      setStatus("確認文字不符，未執行任何移除"); return;
    }
    setRunning(true); setProgress(0); cancelRef.current = false;
    let completed = 0; let moved = 0; let failures = 0;
    const chunks: DriveRecord[][] = [];
    for (let index = 0; index < selectedRecords.length; index += 100) chunks.push(selectedRecords.slice(index, index + 100));
    try {
      for (const chunk of chunks) {
        if (cancelRef.current) break;
        setStatus(`正在移至垃圾桶：${completed.toLocaleString()} / ${count.toLocaleString()}`);
        const response = await fetch("/api/google/trash", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: chunk.map((record) => ({ id: record.id, proof: record.proof })) }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "批次清理失敗");
        for (const outcome of body.outcomes as Array<{ id: string; status: string; size?: number }>) {
          if (outcome.status === "trashed") { moved += outcome.size ?? 0; setSelected((current) => { const next = new Set(current); next.delete(outcome.id); return next; }); }
          else failures += 1;
        }
        completed += chunk.length;
        setTrashedBytes(moved); setProgress(completed / count * 100);
      }
      setStatus(cancelRef.current
        ? `已安全停止；目前釋放 ${formatBytes(moved)}`
        : `完成：已移至垃圾桶 ${formatBytes(moved)}${failures ? `，${failures} 個檔案因安全檢查未移除` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "清理未完成");
    } finally { setRunning(false); }
  }

  async function disconnect() {
    await fetch("/api/google/disconnect", { method: "POST" });
    setConnected(false); setScan(null); setSelected(new Set()); setProgress(0); setStatus("已中斷 Google Drive 連線");
  }

  if (checking) return <div className="cleaner-loading"><i /><span>正在確認安全連線…</span></div>;

  return (
    <div className="cleaner-app">
      <section className="cleaner-statusbar">
        <div className="account">
          {scan?.user?.photoLink ? <img src={scan.user.photoLink} alt="" referrerPolicy="no-referrer" /> : <span className={`account-dot ${connected ? "online" : ""}`} />}{/* eslint-disable-line @next/next/no-img-element */}
          <div><b>{scan?.user?.displayName ?? (connected ? "Google Drive 已連線" : "尚未連線")}</b><small>{scan?.user?.emailAddress ?? "權杖只保存在加密 Cookie"}</small></div>
        </div>
        <div className="cleaner-actions">
          {!connected ? <a className={`button primary ${configured ? "" : "disabled"}`} aria-disabled={!configured} href={configured ? "/api/google/start" : "#oauth-setup"}>{configured ? "使用 Google 登入" : "Google 登入設定中"}</a> : <>
            <button className="button primary" onClick={startScan} disabled={running}>{scan ? "重新掃描" : "開始掃描"}</button>
            <button className="text-button" onClick={disconnect} disabled={running}>中斷連線</button>
          </>}
        </div>
      </section>

      <section className="metric-grid">
        <article><span>預計節省</span><strong>{formatBytes(selectedBytes)}</strong><small>已移至垃圾桶 {formatBytes(trashedBytes)}</small></article>
        <article><span>已選可回收空間</span><strong>{reclaimPercent.toFixed(1)}%</strong><small>{selected.size.toLocaleString()} 個副本</small></article>
        <article><span>雲端總容量占比</span><strong>{quotaLimit ? `${quotaPercent.toFixed(3)}%` : "—"}</strong><small>{quotaLimit ? `總容量 ${formatBytes(quotaLimit)}` : "Google 未提供容量上限"}</small></article>
      </section>

      <section className="animated-progress" aria-live="polite">
        <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
        <div className={`progress-track ${running ? "running" : ""}`}><i style={{ width: `${progress}%` }} /></div>
        {running && scan && <button className="text-button" onClick={() => { cancelRef.current = true; setStatus("將在目前批次完成後安全停止…"); }}>安全停止</button>}
      </section>

      {scan && <>
        <div className="results-toolbar">
          <div><b>{scan.groups.length.toLocaleString()} 組重複檔案</b><span>掃描 {scan.examined.toLocaleString()} 個項目，略過 {scan.skipped.toLocaleString()} 個不適用項目</span></div>
          <div><button className="text-button" onClick={() => setSelected(new Set(records.filter((record) => !record.keeper).map((record) => record.id)))}>選取全部副本</button><button className="text-button" onClick={() => setSelected(new Set())}>清除選取</button></div>
        </div>
        <div className="group-list">
          {scan.groups.slice(0, visibleGroups).map((group, groupIndex) => {
            const key = `${group.fingerprint}-${groupIndex}`;
            const limit = recordLimits[key] ?? 100;
            return <details className="duplicate-group" key={key} open={groupIndex < 3}>
              <summary><span><b>重複群組 {groupIndex + 1}</b><small>{group.records.length.toLocaleString()} 份相同內容</small></span><strong>{formatBytes(group.reclaimableBytes)}</strong></summary>
              <div className="record-list">
                {group.records.slice(0, limit).map((record) => <label className={`record ${record.keeper ? "keeper" : selected.has(record.id) ? "selected" : ""}`} key={record.id}>
                  <input type="checkbox" checked={record.keeper ? false : selected.has(record.id)} disabled={record.keeper || running} onChange={() => toggle(record)} />
                  <span className="file-mark">{record.name.includes(".") ? record.name.split(".").pop()?.slice(0, 4).toUpperCase() : "FILE"}</span>
                  <span className="record-name"><b>{record.name}</b><small>{record.createdTime ? new Date(record.createdTime).toLocaleString("zh-TW") : "日期不明"}</small></span>
                  <span className="record-size">{formatBytes(record.size)}</span>
                  <span className={`record-state ${record.keeper ? "safe" : ""}`}>{record.keeper ? "保留" : selected.has(record.id) ? "移除" : "略過"}</span>
                </label>)}
                {group.records.length > limit && <button className="load-more" onClick={() => setRecordLimits((current) => ({ ...current, [key]: limit + 200 }))}>再顯示 {Math.min(200, group.records.length - limit)} 個副本</button>}
              </div>
            </details>;
          })}
        </div>
        {scan.groups.length > visibleGroups && <button className="load-more" onClick={() => setVisibleGroups((value) => value + 30)}>載入更多重複群組</button>}
        <div className="trash-dock"><div><span>已選 {selected.size.toLocaleString()} 個副本</span><strong>可節省 {formatBytes(selectedBytes)} · {reclaimPercent.toFixed(1)}%</strong></div><button className="button danger" onClick={moveToTrash} disabled={!selected.size || running}>移至 Google Drive 垃圾桶</button></div>
      </>}
    </div>
  );
}
