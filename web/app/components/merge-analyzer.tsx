"use client";

import {
  AlertCircle, ArrowLeftRight, CheckCircle2, Download, FileQuestion, FileSearch,
  FolderInput as FolderIncoming, FolderOpen, FolderOutput, Image as ImageIcon,
  PauseCircle, RefreshCcw, ShieldAlert, ShieldCheck, Video, X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  mergeCsv, recordsFromFolder, type MergeCategory, type MergeFinding,
  type MergeRecord, type MergeResult, type MergeSide,
} from "../../lib/folder-merge";
import { compareFoldersInWorker } from "../../lib/folder-merge-worker";

type FolderSelection = { files: File[]; records: MergeRecord[]; name: string; bytes: number };
type ScanState = "idle" | "scanning" | "done" | "stopped" | "error";
type Filter = "all" | MergeCategory;
const PAGE_SIZE = 20;

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unit]}`;
}

function selectedFolder(files: File[], side: MergeSide): FolderSelection | null {
  if (!files.length) return null;
  const records = recordsFromFolder(files, side);
  const name = records.find((record) => record.rootName)?.rootName || files[0].name;
  return { files, records, name, bytes: files.reduce((sum, file) => sum + file.size, 0) };
}

function FolderPicker({ side, value, onChange, disabled, locale }: {
  side: MergeSide; value: FolderSelection | null; onChange: (value: FolderSelection | null) => void;
  disabled: boolean; locale: "zh-TW" | "en";
}) {
  const input = useRef<HTMLInputElement>(null);
  const en = locale === "en";
  const incoming = side === "incoming";
  return <section className={`merge-folder-card ${incoming ? "incoming" : "destination"}`}>
    <input ref={input} className="sr-only" type="file" multiple disabled={disabled}
      aria-label={en ? `Choose ${incoming ? "incoming" : "destination"} folder` : `選擇${incoming ? "要搬入" : "要合併到"}的資料夾`}
      onChange={(event) => { onChange(selectedFolder(Array.from(event.target.files ?? []), side)); event.target.value = ""; }}
      {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
    <div className="merge-folder-heading"><span>{incoming ? "01" : "02"}</span><div><small>{en ? (incoming ? "INCOMING" : "DESTINATION") : (incoming ? "準備搬入" : "目前保留的位置")}</small><h2>{en ? (incoming ? "Folder to merge" : "Destination folder") : (incoming ? "要搬入的資料夾" : "要合併到的資料夾")}</h2></div></div>
    {value ? <div className="merge-folder-selected"><FolderOpen aria-hidden="true" /><div><strong title={value.name}>{value.name}</strong><span>{en ? `${value.files.length.toLocaleString()} files · ${formatBytes(value.bytes)}` : `${value.files.length.toLocaleString()} 個檔案 · ${formatBytes(value.bytes)}`}</span></div><button type="button" disabled={disabled} aria-label={en ? "Remove folder" : "移除資料夾"} onClick={() => onChange(null)}><X aria-hidden="true" /></button></div>
      : <button className="merge-folder-empty" type="button" disabled={disabled} onClick={() => input.current?.click()}><FolderOpen aria-hidden="true" /><strong>{en ? "Choose folder" : "選擇資料夾"}</strong><span>{en ? "Every subfolder is included" : "包含資料夾內所有子資料夾"}</span></button>}
    {value && <button className="text-button merge-change" type="button" disabled={disabled} onClick={() => input.current?.click()}>{en ? "Choose a different folder" : "更換資料夾"}</button>}
  </section>;
}

function FindingPreview({ finding }: { finding: MergeFinding }) {
  const record = finding.incoming[0] ?? finding.destination[0];
  const canPreview = finding.fileCategory === "image" && record.size <= 12 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif|avif)$/i.test(record.file.type);
  const [source] = useState(() => canPreview ? URL.createObjectURL(record.file) : undefined);
  useEffect(() => { if (!source) return; return () => URL.revokeObjectURL(source); }, [source]);
  if (source) return <Image src={source} alt="" fill sizes="72px" loading="lazy" unoptimized />;
  if (finding.fileCategory === "video") return <Video aria-hidden="true" />;
  if (finding.fileCategory === "image") return <ImageIcon aria-hidden="true" />;
  return <FileSearch aria-hidden="true" />;
}

function FilePaths({ records, side, locale }: { records: MergeRecord[]; side: MergeSide; locale: "zh-TW" | "en" }) {
  const en = locale === "en";
  const incoming = side === "incoming";
  return <div className={`merge-path-column ${incoming ? "incoming" : "destination"}`}>
    <b>{en ? (incoming ? "Incoming" : "Destination") : (incoming ? "要搬入" : "要合併到")}</b>
    {records.length ? records.slice(0, 3).map((record) => <div key={`${record.side}:${record.relativePath}`}><strong title={record.file.name}>{record.file.name}</strong><span title={record.relativePath}>{record.relativePath}</span><small>{formatBytes(record.size)}</small></div>) : <p>{en ? "No matching file" : "沒有對應檔案"}</p>}
    {records.length > 3 && <small>{en ? `${records.length - 3} more files` : `另有 ${records.length - 3} 個檔案`}</small>}
  </div>;
}

function categoryCopy(category: MergeCategory, en: boolean): { title: string; description: string } {
  const values = {
    same_path_conflict: en ? ["Version conflict", "Same relative path, but the content is different."] : ["版本衝突", "相同相對路徑，但檔案內容不同。"],
    renamed_or_moved: en ? ["Already exists under another name", "Exact content exists at a different name or location."] : ["內容已存在，但名稱或位置不同", "內容完全相同，僅檔名或資料夾位置不同。"],
    same_path_same_content: en ? ["Identical at the same location", "The destination already contains this exact content at the same relative path."] : ["同位置、同內容", "要合併到的資料夾在相同位置已有完全一致的內容。"],
    incoming_only: en ? ["New incoming file", "No exact content match was found in the destination."] : ["可以新增的檔案", "要合併到的資料夾裡還沒有這份內容。"],
    destination_only: en ? ["Destination only", "This file exists only in the destination folder."] : ["只存在於目前保留的位置", "要搬入的資料夾中沒有這份內容。"],
  } as const;
  const [title, description] = values[category];
  return { title, description };
}

function FindingCard({ finding, locale }: { finding: MergeFinding; locale: "zh-TW" | "en" }) {
  const en = locale === "en";
  const copy = categoryCopy(finding.category, en);
  return <article className={`merge-finding ${finding.category}`}>
    <div className="merge-finding-heading"><span className="merge-finding-preview"><FindingPreview finding={finding} /></span><div><small>{copy.title}</small><h3>{finding.incoming[0]?.file.name ?? finding.destination[0]?.file.name}</h3><p>{copy.description}</p></div>{finding.contextSensitive && <span className="merge-review-badge"><ShieldAlert aria-hidden="true" />{en ? "Review context" : "檢查用途"}</span>}</div>
    <div className="merge-path-grid"><FilePaths records={finding.incoming} side="incoming" locale={locale} /><span className="merge-path-arrow" aria-hidden="true"><ArrowLeftRight /></span><FilePaths records={finding.destination} side="destination" locale={locale} /></div>
    {finding.contextSensitive && <p className="merge-context-note">{en ? "Project, application or backup context detected. Identical bytes can still serve different roles; keep both unless you understand the dependency." : "偵測到專案、程式或備份情境。位元內容相同仍可能各有用途；不確定依賴關係時，請保留兩份。"}</p>}
  </article>;
}

export function MergeAnalyzer({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  const en = locale === "en";
  const controller = useRef<AbortController | null>(null);
  const [incoming, setIncoming] = useState<FolderSelection | null>(null);
  const [destination, setDestination] = useState<FolderSelection | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  useEffect(() => () => controller.current?.abort(), []);

  const shown = useMemo(() => result?.findings.filter((item) => filter === "all" || item.category === filter) ?? [], [filter, result]);
  const counts = useMemo(() => { const values = new Map<MergeCategory, number>(); result?.findings.forEach((item) => values.set(item.category, (values.get(item.category) ?? 0) + 1)); return values; }, [result]);

  function replaceFolder(side: MergeSide, value: FolderSelection | null): void {
    setResult(null); setState("idle"); setFilter("all"); setPage(0); setProgress(0); setStatus("");
    if (side === "incoming") setIncoming(value); else setDestination(value);
  }

  async function analyze(): Promise<void> {
    if (!incoming || !destination || controller.current) return;
    const run = new AbortController(); controller.current = run;
    setState("scanning"); setResult(null); setFilter("all"); setPage(0); setProgress(0);
    setStatus(en ? "Looking through both folders…" : "正在查看兩個資料夾…");
    try {
      const compared = await compareFoldersInWorker(incoming.records, destination.records, run.signal, (value) => {
        if (controller.current !== run) return;
        setProgress(Math.round(value.percent));
        const phase = value.phase === "sample" ? (en ? "Finding possible duplicates" : "正在找出可能重複的檔案") : value.phase === "full" ? (en ? "Verifying complete file contents" : "正在逐一確認檔案內容") : value.phase === "classify" ? (en ? "Organizing the comparison" : "正在整理比較結果") : (en ? "Looking through both folders" : "正在查看兩個資料夾");
        setStatus(value.path ? `${phase}: ${value.path}` : phase);
      });
      if (controller.current !== run) return;
      setResult(compared); setProgress(100); setState("done"); setStatus(en ? "Comparison complete. No files were changed." : "比較完成，沒有變更任何檔案。");
    } catch {
      if (controller.current !== run) return;
      setState(run.signal.aborted ? "stopped" : "error");
      setStatus(run.signal.aborted ? (en ? "Comparison stopped safely. Nothing was changed." : "核對已安全停止，沒有變更任何檔案。") : (en ? "A file changed or could not be read. Choose the folders again and retry." : "檔案在核對時發生變更或無法讀取。請重新選擇資料夾後再試。"));
    } finally { if (controller.current === run) controller.current = null; }
  }

  function exportReport(): void {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([mergeCsv(result)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url;
    anchor.download = `DUPESPACE-merge-preview-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filters: Filter[] = ["all", "same_path_conflict", "renamed_or_moved", "same_path_same_content", "incoming_only", "destination_only"];
  const decision = result?.summary.conflictPaths
    ? { tone: "urgent", icon: AlertCircle, title: en ? `Resolve ${result.summary.conflictPaths.toLocaleString()} version conflicts before merging.` : `合併前，先處理 ${result.summary.conflictPaths.toLocaleString()} 個版本衝突。`, body: en ? "The same relative paths contain different content. Compare both sides and choose the version intentionally." : "相同相對路徑包含不同內容，請逐一核對左右兩側並主動決定版本。" }
    : result?.summary.reviewFindings
      ? { tone: "warning", icon: ShieldAlert, title: en ? `Review ${result.summary.reviewFindings.toLocaleString()} context-sensitive findings first.` : `先確認 ${result.summary.reviewFindings.toLocaleString()} 個用途敏感項目。`, body: en ? "Projects, applications and backups may need identical files in multiple locations. Keep both unless the dependency is clear." : "專案、程式與備份可能需要不同位置各自保留相同檔案；不確定依賴關係時保留兩份。" }
      : result
        ? { tone: "ready", icon: CheckCircle2, title: en ? "The comparison is ready to review." : "比較完成，可以開始查看結果。", body: en ? "No same-path conflicts or known context risks were detected. The result remains advisory and no files were changed." : "沒有發現同路徑版本衝突或已知風險。你可以查看哪些檔案已存在、哪些可以新增；過程中沒有變更任何檔案。" }
        : null;
  const DecisionIcon = decision?.icon ?? CheckCircle2;
  return <section className="merge-workbench">
    <div className="merge-folder-grid"><FolderPicker side="incoming" value={incoming} onChange={(value) => replaceFolder("incoming", value)} disabled={state === "scanning"} locale={locale} /><div className="merge-direction" aria-hidden="true"><ArrowLeftRight /></div><FolderPicker side="destination" value={destination} onChange={(value) => replaceFolder("destination", value)} disabled={state === "scanning"} locale={locale} /></div>
    <div className="merge-action-bar"><span><ShieldCheck aria-hidden="true" />{en ? "Read by this tab on-device. Files are never sent to a server or changed." : "檔案只在目前分頁中分析，不會上傳或被更動。"}</span><div>{result && <button className="button secondary" type="button" onClick={exportReport}><Download aria-hidden="true" />{en ? "Export CSV" : "匯出 CSV"}</button>}<button className="button primary" type="button" disabled={!incoming || !destination || state === "scanning"} onClick={() => void analyze()}>{result ? <RefreshCcw aria-hidden="true" /> : <FileSearch aria-hidden="true" />}{result ? (en ? "Compare again" : "重新比較") : (en ? "Compare folders" : "開始比較")}</button></div></div>
    {state === "scanning" && <div className="merge-progress"><div><b role="status">{status}</b><strong>{progress}%</strong></div><span><i style={{ width: `${progress}%` }} /></span><button className="text-button" type="button" onClick={() => controller.current?.abort()}><PauseCircle aria-hidden="true" />{en ? "Stop safely" : "安全停止"}</button></div>}
    {(state === "stopped" || state === "error") && <div className="merge-message error"><AlertCircle aria-hidden="true" /><div><b>{state === "error" ? (en ? "Comparison could not finish" : "比較未能完成") : (en ? "Comparison stopped" : "比較已停止")}</b><p>{status}</p></div></div>}
    {result && <div className="merge-results">
      <div className="merge-summary"><article><FolderIncoming aria-hidden="true" /><small>{en ? "Avoid copying again" : "已經存在，不用再複製"}</small><strong>{result.summary.avoidCopyFiles.toLocaleString()}</strong><span>{formatBytes(result.summary.avoidCopyBytes)}</span></article><article><FolderOutput aria-hidden="true" /><small>{en ? "New incoming files" : "可以新增的檔案"}</small><strong>{result.summary.incomingOnlyFiles.toLocaleString()}</strong><span>{en ? "No exact match" : "目前還沒有相同內容"}</span></article><article className={result.summary.conflictPaths ? "urgent" : ""}><FileQuestion aria-hidden="true" /><small>{en ? "Version conflicts" : "版本衝突"}</small><strong>{result.summary.conflictPaths.toLocaleString()}</strong><span>{en ? "Review before merging" : "合併前必須確認"}</span></article><article className={result.summary.reviewFindings ? "warning" : ""}><ShieldAlert aria-hidden="true" /><small>{en ? "Context review" : "需要人工確認"}</small><strong>{result.summary.reviewFindings.toLocaleString()}</strong><span>{en ? "Projects, apps or backups" : "專案、程式或備份"}</span></article></div>
      {decision && <div className={`merge-decision ${decision.tone}`}><DecisionIcon aria-hidden="true" /><div><b>{decision.title}</b><p>{decision.body}</p></div></div>}
      <div className="merge-result-heading"><div><span className="eyebrow">{en ? "COMPARISON RESULTS" : "比較結果"}</span><h2>{en ? "See what will happen before you merge." : "合併之前，先知道會發生什麼。"}</h2><p>{en ? `${result.summary.incomingFiles.toLocaleString()} incoming and ${result.summary.destinationFiles.toLocaleString()} destination files analyzed. ${result.summary.ignoredEmptyFiles.toLocaleString()} empty files ignored.` : `已比較 ${result.summary.incomingFiles.toLocaleString()} 個要搬入的檔案與 ${result.summary.destinationFiles.toLocaleString()} 個現有檔案；略過 ${result.summary.ignoredEmptyFiles.toLocaleString()} 個空白檔案。`}</p></div><span><CheckCircle2 aria-hidden="true" />{en ? "Read-only result" : "沒有更動檔案"}</span></div>
      <div className="merge-filters" role="tablist" aria-label={en ? "Filter comparison results" : "篩選比較結果"}>{filters.map((value) => { const label = value === "all" ? (en ? "All" : "全部") : categoryCopy(value, en).title; const count = value === "all" ? result.findings.length : counts.get(value) ?? 0; return <button key={value} type="button" role="tab" aria-selected={filter === value} disabled={!count} onClick={() => { setFilter(value); setPage(0); }}>{label}<span>{count}</span></button>; })}</div>
      {shown.length ? <div className="merge-findings">{shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => <FindingCard key={item.id} finding={item} locale={locale} />)}</div> : <div className="merge-message"><CheckCircle2 aria-hidden="true" /><div><b>{en ? "No results in this category" : "這個分類沒有項目"}</b><p>{en ? "Choose another filter to continue reviewing the comparison." : "切換其他分類，繼續查看比較結果。"}</p></div></div>}
      {shown.length > PAGE_SIZE && <nav className="merge-pagination" aria-label={en ? "Comparison result pages" : "比較結果分頁"}><button className="button secondary" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{en ? "Previous" : "上一頁"}</button><span>{page + 1} / {Math.ceil(shown.length / PAGE_SIZE)}</span><button className="button secondary" type="button" disabled={(page + 1) * PAGE_SIZE >= shown.length} onClick={() => setPage((value) => value + 1)}>{en ? "Next" : "下一頁"}</button></nav>}
    </div>}
  </section>;
}
