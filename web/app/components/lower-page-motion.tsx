"use client";

import { productFaq } from "../../lib/product-copy";

import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  HardDrive,
  Code2,
  Database,
  Download,
  FileCheck2,
  FolderLock,
  Lock,
  Settings2,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

const causes = [
  { label: "跨資料夾複製", value: 46, color: "teal" },
  { label: "重複下載", value: 31, color: "emerald" },
  { label: "通訊軟體暫存", value: 15, color: "amber" },
  { label: "其他來源", value: 8, color: "slate" },
] as const;

const profiles: Array<{ icon: LucideIcon; title: string; status: string }> = [
  { icon: Code2, title: "軟體專案模式", status: "專案與套件硬性排除" },
  { icon: FolderLock, title: "影音備份模式", status: "備份來源持續保護" },
  { icon: Settings2, title: "自訂白名單", status: "3 個路徑受到保護" },
];

const comparisons = [
  ["如何判定重複？", "比對內容，不只看檔名"],
  ["網頁會刪檔嗎？", "只分析與匯出報告，不修改檔案"],
  ["桌面版怎麼整理？", "預設移至垃圾桶，逐筆留下 CSV"],
  ["專案與工作檔案呢？", "排除偵測到的專案，支援子資料夾保護"],
  ["可以檢查實作嗎？", "免費開源，可閱讀與檢查程式碼"],
] as const;

const questions = productFaq["zh-TW"];

function CountUp({ from, to, suffix = "" }: { from: number; to: number; suffix?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const inView = useInView(node, { once: true, amount: 0.8 });
  const reducedMotion = useReducedMotion();
  const value = useMotionValue(reducedMotion ? to : from);
  const rounded = useTransform(value, (latest) => `${Math.round(latest)}${suffix}`);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const controls = animate(value, to, { duration: 1.15, delay: 0.18, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [inView, reducedMotion, to, value]);

  return <motion.span ref={node}>{rounded}</motion.span>;
}

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 150, damping: 22 } },
};

export function StorageIntelligenceMotion() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="intelligence-bento"
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      variants={{ visible: { transition: { staggerChildren: 0.11 } } }}
    >
      <motion.article className="intelligence-card health-trend-card" variants={reveal}>
        <div className="intelligence-card-head"><span><TrendingUp size={18} aria-hidden="true" /></span><div><small>HEALTH TREND</small><h3>整理成果趨勢 · 規劃中</h3></div><strong><CountUp from={28} to={98} /><small>/100</small></strong></div>
        <div className="trend-visual" aria-label="整理後健康指標由 28 分提升至 98 分">
          <svg viewBox="0 0 620 190" role="img" aria-hidden="true">
            <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14b8a6" stopOpacity=".38" /><stop offset="1" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
            <path className="trend-gridline" d="M0 42H620M0 96H620M0 150H620" />
            <motion.path className="trend-area" d="M0 154 C70 150 94 137 142 140 S225 126 270 130 S350 102 394 105 S469 58 515 68 S574 28 620 22 V190 H0Z" initial={reducedMotion ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: .8, delay: .3 }} />
            <motion.path className="trend-line" d="M0 154 C70 150 94 137 142 140 S225 126 270 130 S350 102 394 105 S469 58 515 68 S574 28 620 22" initial={reducedMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.25, delay: .2, ease: "easeOut" }} />
          </svg>
          <div className="trend-labels"><span>首次掃描</span><span>整理目標（示意）</span></div>
        </div>
        <div className="trend-summary"><span><CheckCircle2 size={15} aria-hidden="true" />候選示例 <b>18.6 GB</b></span><span>介面示意 <b>非實測</b></span></div>
      </motion.article>

      <motion.article className="intelligence-card cause-card" variants={reveal}>
        <div className="intelligence-card-head"><span><BarChart3 size={18} aria-hidden="true" /></span><div><small>CAUSE ANALYSIS</small><h3>重複成因分析 · 規劃中</h3></div></div>
        <p>方向示意：從路徑線索整理可能來源，不把猜測當作事實。</p>
        <div className="cause-bars">
          {causes.map((cause, index) => <div key={cause.label}><div><span>{cause.label}</span><b>{cause.value}%</b></div><i><motion.em className={cause.color} initial={reducedMotion ? { width: `${cause.value}%` } : { width: 0 }} whileInView={{ width: `${cause.value}%` }} viewport={{ once: true }} transition={{ duration: .7, delay: .28 + index * .1, ease: [0.22, 1, 0.36, 1] }} /></i></div>)}
        </div>
      </motion.article>

      <motion.article className="intelligence-card profile-card" variants={reveal}>
        <div className="intelligence-card-head"><span><ShieldCheck size={18} aria-hidden="true" /></span><div><small>PROTECTED PROFILES</small><h3>自訂防護設定檔</h3></div><em>Windows 示意</em></div>
        <p>把常用位置與保護子資料夾存成設定檔，下次選取即可套用。</p>
        <div className="profile-list">
          {profiles.map(({ icon: Icon, title, status }, index) => <motion.div key={title} initial={reducedMotion ? false : { opacity: 0, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: .3 + index * .1 }}><span><Icon size={17} aria-hidden="true" /></span><div><b>{title}</b><small>{status}</small></div><CheckCircle2 size={17} aria-hidden="true" /></motion.div>)}
        </div>
        <div className="protection-scan" aria-hidden="true"><motion.i animate={reducedMotion ? undefined : { x: ["-15%", "540%"] }} transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }} /></div>
      </motion.article>
    </motion.div>
  );
}

export function PrivacyFlowMotion() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div className="privacy-flow-card" initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ type: "spring", stiffness: 145, damping: 22 }}>
      <div className="privacy-flow-title"><span><Lock size={18} aria-hidden="true" /></span><div><small>LOCAL-FIRST BOUNDARY</small><b>分析留在你的裝置</b></div></div>
      <div className="privacy-flow" aria-label="本機檔案只在瀏覽器中分析，不會傳送到 DUPESPACE 伺服器">
        <div className="flow-node"><HardDrive size={25} aria-hidden="true" /><b>你的資料夾</b><small>檔案內容留在裝置</small></div>
        <div className="flow-route"><span>大小 · 分塊指紋</span><i /><motion.em animate={reducedMotion ? undefined : { left: ["8%", "88%"], opacity: [0, 1, 1, 0] }} transition={{ duration: 2.7, repeat: Infinity, repeatDelay: .7, ease: "easeInOut" }} /></div>
        <div className="flow-node safe"><ShieldCheck size={25} aria-hidden="true" /><b>你的瀏覽器</b><small>只產生本機報告</small></div>
      </div>
      <div className="content-stays"><FileCheck2 size={18} aria-hidden="true" /><span><b>零上傳、零帳號、零刪除權限</b><small>檔案清單與分析結果只留在這台裝置</small></span></div>
      <div className="privacy-badges"><span><Lock size={13} aria-hidden="true" /> 零上傳</span><span><Database size={13} aria-hidden="true" /> 裝置端計算</span><span><ShieldCheck size={13} aria-hidden="true" /> 唯讀分析</span></div>
      <div className="limited-use-copy"><b>清楚的權限邊界</b><p>DUPESPACE 網頁版只能讀取你在檔案選擇器中主動交付的檔案，無法瀏覽其他位置，也無法刪除或移動檔案。關閉分頁後，未匯出的分析結果即從記憶體移除。</p></div>
    </motion.div>
  );
}

export function TrustMatrixMotion({ repository }: { repository: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div className="trust-motion-layout" initial={reducedMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: .18 }} variants={{ visible: { transition: { staggerChildren: .085 } } }}>
      <div className="trust-table trust-table-motion" role="table" aria-label="DUPESPACE 的功能與安全邊界">
        <motion.div role="row" variants={reveal}><b role="columnheader">你在意的事</b><b role="columnheader"><ShieldCheck size={17} aria-hidden="true" />DUPESPACE 的做法</b></motion.div>
        {comparisons.map(([question, answer]) => <motion.div role="row" variants={reveal} key={question}><span role="cell">{question}</span><span role="cell"><CheckCircle2 size={17} aria-hidden="true" />{answer}</span></motion.div>)}
      </div>
      <motion.aside className="open-source-proof" variants={reveal}><span><Code2 size={24} aria-hidden="true" /></span><small>OPEN SOURCE PROOF</small><h3>不只要求你相信，還能親自驗證。</h3><p lang="en">Read the code. Verify the claims. Run it yourself.</p><a className="button secondary" href={repository}>在 GitHub 查看原始碼</a><div><Download size={15} aria-hidden="true" /><span>免費下載</span><Lock size={15} aria-hidden="true" /><span>安全規則公開</span></div></motion.aside>
    </motion.div>
  );
}

export function FaqMotion() {
  const [open, setOpen] = useState<number | null>(0);
  const reducedMotion = useReducedMotion();
  return (
    <motion.div className="faq-motion-list" initial={reducedMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: .12 }} variants={{ visible: { transition: { staggerChildren: .08 } } }}>
      {questions.map(({ question, answer }, index) => {
        const expanded = open === index;
        return <motion.article key={question} variants={reveal} className={expanded ? "open" : ""}><h3><button type="button" aria-expanded={expanded} aria-controls={`faq-answer-${index}`} onClick={() => setOpen(expanded ? null : index)}><span><small>0{index + 1}</small>{question}</span><motion.i animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : .22 }}><ChevronDown size={19} aria-hidden="true" /></motion.i></button></h3><AnimatePresence initial={false}>{expanded && <motion.div id={`faq-answer-${index}`} role="region" initial={reducedMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .25, ease: [0.22, 1, 0.36, 1] }}><p>{answer}</p></motion.div>}</AnimatePresence></motion.article>;
      })}
    </motion.div>
  );
}
