"use client";

import { AlertCircle, CheckCircle2, Download, FileSearch, FolderOpen, FolderTree, Gauge, HardDrive, Image as ImageIcon, Laptop, PauseCircle, ScanSearch, ShieldAlert, ShieldCheck, Video } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { analysisCsv, localInsights, type DuplicateGroup, type LocalRecord } from "../../lib/local-analysis";
import { findLocalDuplicatesInWorker } from "../../lib/local-analysis-worker";
import { WorkerStartupError } from "../../lib/analysis-worker-error";
import { dupeJobJson } from "../../lib/dupejob";

type ScanState = "idle" | "scanning" | "done" | "stopped" | "error";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unit]}`;
}

function LocalPreview({ record, category }: { record: LocalRecord; category: DuplicateGroup["category"] }) {
  const [source] = useState(() => category === "image" && record.size <= 12 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif|avif)$/i.test(record.file.type) ? URL.createObjectURL(record.file) : undefined);
  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source);
  }, [source]);
  if (source) return <Image src={source} alt="" fill sizes="80px" loading="lazy" unoptimized />;
  if (category === "video") return <Video size={28} aria-hidden="true" />;
  if (category === "image") return <ImageIcon size={28} aria-hidden="true" />;
  return <FileSearch size={28} aria-hidden="true" />;
}

export function LocalAnalyzer({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  const en = locale === "en";
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  const [state, setState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(en ? "Choose a folder to begin." : "選擇資料夾後即可開始。");
  const [filesExamined, setFilesExamined] = useState(0);
  const [selectedBytes, setSelectedBytes] = useState(0);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);

  const duplicateBytes = useMemo(() => groups.reduce((total, group) => total + group.duplicateBytes, 0), [groups]);
  const duplicateFiles = useMemo(() => groups.reduce((total, group) => total + group.files.length - 1, 0), [groups]);
  const insights = useMemo(() => localInsights(groups, selectedBytes), [groups, selectedBytes]);

  async function analyze(selected: File[]): Promise<void> {
    if (controller.current || !selected.length) return;
    const run = new AbortController();
    controller.current = run;
    setState("scanning"); setGroups([]); setProgress(0); setPage(0); setNotice("");
    const records = selected.filter((file) => file.size > 0).map((file) => ({ file, path: file.webkitRelativePath || file.name, size: file.size, lastModified: file.lastModified }));
    setFilesExamined(records.length);
    setSelectedBytes(records.reduce((sum, record) => sum + record.size, 0));
    setStatus(en ? "Preparing selected files…" : "正在準備選取的檔案…");
    try {
      const found = await findLocalDuplicatesInWorker(records, run.signal, (value) => {
        if (controller.current !== run) return;
        setProgress(Math.round(value.percent));
        const phase = value.phase === "sample" ? (en ? "Finding possible duplicates" : "正在找出可能重複的檔案") : (en ? "Verifying complete file contents" : "正在逐一確認檔案內容");
        const metric = value.phase === "sample" && value.candidateFiles
          ? `${value.processedFiles?.toLocaleString()} / ${value.candidateFiles.toLocaleString()}`
          : value.totalBytes
            ? `${formatBytes(value.processedBytes ?? 0)} / ${formatBytes(value.totalBytes)}`
            : "";
        const path = value.path.length > 64 ? `…${value.path.slice(-63)}` : value.path;
        setStatus(`${phase}${metric ? ` · ${metric}` : ""}${path ? ` · ${path}` : ""}`);
      });
      if (controller.current !== run) return;
      setGroups(found); setProgress(100); setState("done");
      setStatus(en ? "Analysis complete. No files were modified." : "分析完成，沒有任何檔案被修改。");
    } catch (error) {
      if (controller.current !== run) return;
      setState(run.signal.aborted ? "stopped" : "error");
      setStatus(run.signal.aborted
        ? (en ? "Analysis stopped safely. No files were changed." : "分析已安全停止，沒有任何檔案被修改。")
        : error instanceof WorkerStartupError
          ? (en ? "The browser could not start the analysis. Your files were not changed. Reload this page and try again; if it persists, try another browser." : "瀏覽器無法啟動分析程式，檔案沒有被更動。請重新整理頁面再試；若仍失敗，可換一個瀏覽器。")
          : (en ? "A file could not be read or changed during analysis. Your files are safe. Choose the folder again, or use the Windows app for a large folder." : "有檔案無法讀取，或在分析時被修改，所以這次分析已停止。檔案沒有被變更；請重新選擇資料夾再試，檔案很多時也可以改用 Windows 版。"));
    } finally { if (controller.current === run) controller.current = null; }
  }

  function exportReport(): void {
    const url = URL.createObjectURL(new Blob([analysisCsv(groups)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `DUPESPACE-local-analysis-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportDupeJob(): void {
    try {
      const url = URL.createObjectURL(new Blob([dupeJobJson(groups)], { type: "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `DUPESPACE-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.dupejob`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(en ? "Continuation file downloaded. Open it in the Windows app to verify the listed files and continue." : "接續檔已下載。請在 Windows 版開啟，確認清單後繼續整理。");
    } catch {
      setNotice(en ? "Choose one folder with Choose folder before exporting a DupeJob." : "請先用「選擇資料夾」分析單一資料夾，才能匯出 DupeJob。");
    }
  }

  return <section className="local-analyzer" >
    <input ref={input} className="sr-only" aria-label={en ? "Select a local folder" : "選擇本機資料夾"} type="file" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void analyze(files); }} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
    <div className={`local-dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (controller.current) return; if (Array.from(event.dataTransfer.items).some((item) => item.webkitGetAsEntry?.()?.isDirectory)) { setNotice(en ? "For folders, use Choose folder to include every subfolder. You can drop individual files here." : "要完整包含所有子資料夾，請使用「選擇資料夾」。也可直接拖入個別檔案。"); return; } void analyze(Array.from(event.dataTransfer.files)); }}>
      <span className="local-drop-icon"><FolderOpen size={30} aria-hidden="true" /></span>
      <div><h2>{en ? "Choose a folder and find exact duplicates in your browser." : "選擇一個資料夾，直接在瀏覽器找出重複檔案。"}</h2><p>{en ? "DUPESPACE quickly narrows the list, then verifies complete file contents. Nothing is uploaded or deleted." : "DUPESPACE 會先快速篩選，再完整確認檔案內容。檔案不會上傳，網頁也不會刪除任何內容。"}</p></div>
      <button className="button primary" type="button" onClick={() => input.current?.click()} disabled={state === "scanning"}><FolderOpen size={18} aria-hidden="true" />{en ? "Choose folder" : "選擇資料夾"}</button>
    </div>
    {notice && <p role="status" className="local-warning">{notice}</p>}
    <div className="local-privacy-row"><span><ShieldCheck size={16} aria-hidden="true" />{en ? "Never sent to a server" : "不傳送至伺服器"}</span><span><HardDrive size={16} aria-hidden="true" />{en ? "On-device analysis" : "裝置端分析"}</span><span><CheckCircle2 size={16} aria-hidden="true" />{en ? "Read-only report" : "唯讀報告"}</span></div>
    <details className="technical-details local-technical-details"><summary>{en ? "How files are compared" : "了解比對方式"}</summary><p>{en ? "DUPESPACE first groups exact file sizes, samples content to rule out obvious differences, then reads every remaining candidate in chunks and verifies a SHA-256 content fingerprint." : "DUPESPACE 先依檔案大小排除不可能相同的項目，再抽樣縮小範圍，最後逐段讀取完整檔案並確認 SHA-256 內容指紋。抽樣結果不會直接被當成重複判定。"}</p></details>
    {state !== "idle" && <div className="local-progress-card"><div><b role="status">{status}</b><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{en ? `${filesExamined.toLocaleString()} non-empty files selected` : `已選取 ${filesExamined.toLocaleString()} 個非空白檔案`}</small>{state === "scanning" && <button className="text-button" type="button" onClick={() => { controller.current?.abort(); }}><PauseCircle size={16} aria-hidden="true" />{en ? "Stop safely" : "安全停止"}</button>}</div>}
    {state === "done" && <div className="local-results-summary"><article><small>{en ? "Duplicate groups" : "重複群組"}</small><strong>{groups.length}</strong></article><article><small>{en ? "Duplicate copies" : "重複副本"}</small><strong>{duplicateFiles}</strong></article><article><small>{en ? "Space used by duplicate copies" : "重複副本占用容量"}</small><strong>{formatBytes(duplicateBytes)}</strong></article>{groups.length > 0 && <div className="local-export-actions"><button type="button" className="button primary" onClick={exportDupeJob}><Laptop size={17} aria-hidden="true" />{en ? "Continue in Windows" : "在 Windows 版繼續整理"}</button><button type="button" className="button secondary" onClick={exportReport}><Download size={17} aria-hidden="true" />{en ? "Export CSV" : "匯出 CSV"}</button></div>}</div>}
    {state === "done" && groups.length === 0 && <div className="local-empty"><CheckCircle2 size={38} aria-hidden="true" /><h2>{filesExamined < 2 ? (en ? "Not enough files to compare." : "沒有足夠的檔案可以比較。") : (en ? "No exact duplicates found." : "沒有找到完全相同的檔案")}</h2><p>{en ? "This folder looks clean. Choose another folder whenever you are ready." : "這個資料夾目前很乾淨。你可以換一個資料夾繼續檢查。"}</p><button type="button" className="button primary" onClick={() => input.current?.click()}>{en ? "Analyze another folder" : "檢查其他資料夾"}</button></div>}
    {groups.length > 0 && <section className="local-intelligence" aria-labelledby="local-intelligence-title"><div className="local-intelligence-heading"><div><span className="eyebrow"><ScanSearch size={15} aria-hidden="true" />{en ? "ANALYSIS HIGHLIGHTS" : "分析重點"}</span><h2 id="local-intelligence-title">{en ? "A decision report, not just a duplicate count." : "不只列出重複，也告訴你該先檢查哪裡。"}</h2></div><p>{en ? "Use these signals to decide where to review first. Exact content can still serve different purposes." : "先從風險較高或容量較大的群組開始；內容完全相同，仍可能有不同用途。"}</p></div><div className="local-intelligence-grid"><article><FolderTree aria-hidden="true" /><small>{en ? "Renamed exact matches" : "改名後仍相同"}</small><strong>{insights.renamedGroups.toLocaleString()}</strong><span>{en ? "groups with different filenames" : "組內容相同、檔名不同"}</span></article><article><HardDrive aria-hidden="true" /><small>{en ? "Cross-folder copies" : "跨資料夾副本"}</small><strong>{insights.crossFolderGroups.toLocaleString()}</strong><span>{en ? "groups span multiple locations" : "組分散在不同位置"}</span></article><article className={insights.contextReviewGroups ? "warning" : ""}><ShieldAlert aria-hidden="true" /><small>{en ? "Manual review suggested" : "建議人工確認"}</small><strong>{insights.contextReviewGroups.toLocaleString()}</strong><span>{en ? "project, app or backup groups" : "組涉及專案、程式或備份"}</span></article><article><Gauge aria-hidden="true" /><small>{en ? "Duplicate copy share" : "重複副本占比"}</small><strong>{insights.duplicateRatio < .1 && insights.duplicateRatio > 0 ? "<0.1" : insights.duplicateRatio.toFixed(1)}%</strong><span>{en ? `of ${formatBytes(selectedBytes)} analyzed` : `占本次分析 ${formatBytes(selectedBytes)}`}</span></article></div><div className="local-next-action"><div><ShieldCheck aria-hidden="true" /><span><b>{insights.contextReviewGroups ? (en ? "Review context-sensitive groups first." : "先檢查可能各有用途的群組。") : (en ? "Start with the largest duplicate groups." : "可先從容量最大的重複群組開始。")}</b><small>{en ? "The browser stays read-only. Use the Windows app when you are ready to move reviewed copies to the Recycle Bin." : "網頁不會刪除檔案；確認用途後，可在 Windows 版把不需要的副本移至資源回收筒。"}</small></span></div><a className="button secondary" href={en ? "/en/download/" : "/download"}>{en ? "Open Windows options" : "查看 Windows 整理方式"}</a></div></section>}
    {groups.length > 0 && <><p className="local-review-note">{en ? "Identical content does not mean a copy is unnecessary. Review what each copy is used for; this report does not decide what to delete." : "內容相同，不代表其中一份一定沒用。請先確認每份檔案的用途；這份結果不會替你決定要刪除哪一份。"}</p><details className="technical-details local-sort-details"><summary>{en ? "How the comparison file is chosen" : "排序依據"}</summary><p>{en ? "Browsers cannot reliably read file creation times. The first file shown is ordered by modification time and path for consistent results; it is a comparison reference, not proof of the original." : "瀏覽器無法可靠取得建立時間，因此會依修改時間與路徑建立一致順序。第一個顯示的檔案只是比對基準，不代表它是原始檔。"}</p></details></>}
    {groups.length > 0 && <div className="local-groups">{groups.slice(page * 20, (page + 1) * 20).map((group, groupIndex) => <article key={group.id} className="local-group"><div className="local-group-preview"><LocalPreview key={group.files[0].path} record={group.files[0]} category={group.category} /></div><div className="local-group-main"><small>{en ? `Group ${page * 20 + groupIndex + 1} · ${group.files.length - 1} duplicate copies` : `群組 ${page * 20 + groupIndex + 1} · ${group.files.length - 1} 個重複副本`}</small><h3>{group.files[0].file.name}</h3><p>{group.files[0].path}</p><span><ShieldCheck size={14} aria-hidden="true" />{en ? "Comparison reference, not necessarily the original" : "比對基準，不代表原始檔"}</span>{group.contextSensitive && <small className="local-context-warning">{en ? "Project, app or backup: both copies may be needed." : "專案、程式或備份情境：兩份可能都需要保留。"}</small>}</div><div className="local-group-copies">{group.files.slice(1, 4).map((record) => <p key={record.path}><b>{record.file.name}</b><small>{record.path}</small></p>)}{group.files.length > 4 && <small>{en ? `and ${group.files.length - 4} more` : `另有 ${group.files.length - 4} 個副本`}</small>}</div><strong>{formatBytes(group.duplicateBytes)}</strong></article>)}{groups.length > 20 && <nav className="local-pagination" aria-label={en ? "Results pages" : "結果分頁"}><button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{en ? "Previous" : "上一頁"}</button><span>{page + 1} / {Math.ceil(groups.length / 20)}</span><button type="button" className="button secondary" disabled={(page + 1) * 20 >= groups.length} onClick={() => setPage((value) => value + 1)}>{en ? "Next" : "下一頁"}</button></nav>}</div>}
    {(state === "stopped" || state === "error") && <div className="local-warning"><AlertCircle size={20} aria-hidden="true" /><p>{status}</p><button type="button" className="button secondary" onClick={() => input.current?.click()}>{en ? "Choose again" : "重新選擇"}</button></div>}
  </section>;
}
