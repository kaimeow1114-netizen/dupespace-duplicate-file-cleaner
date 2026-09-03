"use client";

import { AlertCircle, CheckCircle2, Download, FileSearch, FolderOpen, HardDrive, Image as ImageIcon, PauseCircle, ShieldCheck, Video } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { analysisCsv, findLocalDuplicates, type DuplicateGroup, type LocalRecord } from "../../lib/local-analysis";

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
  const [status, setStatus] = useState(en ? "Choose a folder to begin." : "選擇資料夾後即可開始。 ");
  const [filesExamined, setFilesExamined] = useState(0);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);

  const duplicateBytes = useMemo(() => groups.reduce((total, group) => total + group.duplicateBytes, 0), [groups]);
  const duplicateFiles = useMemo(() => groups.reduce((total, group) => total + group.files.length - 1, 0), [groups]);

  async function analyze(selected: File[]): Promise<void> {
    if (controller.current || !selected.length) return;
    const run = new AbortController();
    controller.current = run;
    setState("scanning"); setGroups([]); setProgress(0); setPage(0); setNotice("");
    const records = selected.filter((file) => file.size > 0).map((file) => ({ file, path: file.webkitRelativePath || file.name, size: file.size, lastModified: file.lastModified }));
    setFilesExamined(records.length);
    setStatus(en ? "Preparing selected files…" : "正在準備選取的檔案…");
    try {
      const found = await findLocalDuplicates(records, run.signal, (value) => {
        if (controller.current !== run) return;
        setProgress(Math.round(value.percent));
        setStatus(`${value.phase === "sample" ? (en ? "Filtering candidates" : "快速篩選候選") : (en ? "Comparing full content" : "完整比對內容")}：${value.path}`);
      });
      if (controller.current !== run) return;
      setGroups(found); setProgress(100); setState("done");
      setStatus(en ? "Analysis complete. No files were modified." : "分析完成，沒有任何檔案被修改。");
    } catch {
      if (controller.current !== run) return;
      setState(run.signal.aborted ? "stopped" : "error");
      setStatus(run.signal.aborted ? (en ? "Analysis stopped safely. No files were changed." : "分析已安全停止，沒有任何檔案被修改。") : (en ? "A file could not be read or changed during analysis. Choose the folder again or use the Windows app." : "檔案無法讀取或在分析期間發生變更。請重新選擇資料夾，或使用 Windows 版。"));
    } finally { if (controller.current === run) controller.current = null; }
  }

  function exportReport(): void {
    const url = URL.createObjectURL(new Blob([analysisCsv(groups)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `DUPESPACE-local-analysis-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="local-analyzer" >
    <input ref={input} className="sr-only" aria-label={en ? "Select a local folder" : "選擇本機資料夾"} type="file" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void analyze(files); }} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
    <div className={`local-dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (controller.current) return; if (Array.from(event.dataTransfer.items).some((item) => item.webkitGetAsEntry?.()?.isDirectory)) { setNotice(en ? "For folders, use Choose folder to include every subfolder. You can drop individual files here." : "要完整包含所有子資料夾，請使用「選擇資料夾」。也可直接拖入個別檔案。"); return; } void analyze(Array.from(event.dataTransfer.files)); }}>
      <span className="local-drop-icon"><FolderOpen size={30} aria-hidden="true" /></span>
      <div><h2>{en ? "Choose a folder. Keep every file on your device." : "選擇資料夾，檔案仍留在你的裝置。 "}</h2><p>{en ? "DUPESPACE filters by size, then compares content in chunks. The browser produces a read-only report and cannot delete files." : "DUPESPACE 先按大小篩選，再以分塊內容指紋完整比對。瀏覽器只產生唯讀報告，沒有刪除權限。 "}</p></div>
      <button className="button primary" type="button" onClick={() => input.current?.click()} disabled={state === "scanning"}><FolderOpen size={18} aria-hidden="true" />{en ? "Choose folder" : "選擇資料夾"}</button>
    </div>
    {notice && <p role="status" className="local-warning">{notice}</p>}
    <div className="local-privacy-row"><span><ShieldCheck size={16} aria-hidden="true" />{en ? "No upload" : "零上傳"}</span><span><HardDrive size={16} aria-hidden="true" />{en ? "On-device analysis" : "裝置端分析"}</span><span><CheckCircle2 size={16} aria-hidden="true" />{en ? "Read-only report" : "唯讀報告"}</span></div>
    {state !== "idle" && <div className="local-progress-card"><div><b role="status">{status}</b><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{en ? `${filesExamined.toLocaleString()} non-empty files selected` : `已選取 ${filesExamined.toLocaleString()} 個非空白檔案`}</small>{state === "scanning" && <button className="text-button" type="button" onClick={() => { controller.current?.abort(); }}><PauseCircle size={16} aria-hidden="true" />{en ? "Stop safely" : "安全停止"}</button>}</div>}
    {state === "done" && <div className="local-results-summary"><article><small>{en ? "Duplicate groups" : "重複群組"}</small><strong>{groups.length}</strong></article><article><small>{en ? "Duplicate copies" : "重複副本"}</small><strong>{duplicateFiles}</strong></article><article><small>{en ? "Candidate capacity" : "重複候選容量"}</small><strong>{formatBytes(duplicateBytes)}</strong></article>{groups.length > 0 && <button type="button" className="button secondary" onClick={exportReport}><Download size={17} aria-hidden="true" />{en ? "Export CSV" : "匯出 CSV"}</button>}</div>}
    {state === "done" && groups.length === 0 && <div className="local-empty"><CheckCircle2 size={38} aria-hidden="true" /><h2>{filesExamined < 2 ? (en ? "Not enough files to compare." : "沒有足夠的檔案可供比對。") : (en ? "No exact duplicates found." : "沒有找到內容完全相同的檔案。")}</h2><p>{en ? "No exact duplicates were found. Choose another folder whenever you are ready." : "沒有找到內容完全相同的檔案。你可以繼續分析其他資料夾。 "}</p><button type="button" className="button primary" onClick={() => input.current?.click()}>{en ? "Analyze another folder" : "分析其他資料夾"}</button></div>}
    {groups.length > 0 && <p className="local-review-note">{en ? "Identical content does not mean a copy is unnecessary. Reference order uses modification time, not creation time (unavailable in browsers). Review each file’s purpose; this is not deletion advice." : "內容相同不代表副本沒有用途。參考檔案依修改時間排序，不代表原始檔案（瀏覽器無法可靠取得建立時間）；請確認每份檔案的用途，報告不是刪除建議。"}</p>}
    {groups.length > 0 && <div className="local-groups">{groups.slice(page * 20, (page + 1) * 20).map((group, groupIndex) => <article key={group.id} className="local-group"><div className="local-group-preview"><LocalPreview key={group.files[0].path} record={group.files[0]} category={group.category} /></div><div className="local-group-main"><small>{en ? `Group ${page * 20 + groupIndex + 1} · ${group.files.length - 1} duplicate copies` : `群組 ${page * 20 + groupIndex + 1} · ${group.files.length - 1} 個重複副本`}</small><h3>{group.files[0].file.name}</h3><p>{group.files[0].path}</p><span><ShieldCheck size={14} aria-hidden="true" />{en ? "Reference only" : "參考檔案"}</span>{group.contextSensitive && <small className="local-context-warning">{en ? "Project, app or backup: both copies may be needed." : "專案、程式或備份情境：兩份可能都需要保留。"}</small>}</div><div className="local-group-copies">{group.files.slice(1, 4).map((record) => <p key={record.path}><b>{record.file.name}</b><small>{record.path}</small></p>)}{group.files.length > 4 && <small>{en ? `and ${group.files.length - 4} more` : `另有 ${group.files.length - 4} 個副本`}</small>}</div><strong>{formatBytes(group.duplicateBytes)}</strong></article>)}{groups.length > 20 && <nav className="local-pagination" aria-label={en ? "Results pages" : "結果分頁"}><button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{en ? "Previous" : "上一頁"}</button><span>{page + 1} / {Math.ceil(groups.length / 20)}</span><button type="button" className="button secondary" disabled={(page + 1) * 20 >= groups.length} onClick={() => setPage((value) => value + 1)}>{en ? "Next" : "下一頁"}</button></nav>}</div>}
    {(state === "stopped" || state === "error") && <div className="local-warning"><AlertCircle size={20} aria-hidden="true" /><p>{status}</p><button type="button" className="button secondary" onClick={() => input.current?.click()}>{en ? "Choose again" : "重新選擇"}</button></div>}
  </section>;
}
