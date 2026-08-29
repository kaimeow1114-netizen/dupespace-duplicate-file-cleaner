"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Code2,
  Database,
  Download,
  FileCheck2,
  FolderLock,
  Lock,
  Settings2,
  ShieldCheck,
  TrendingUp,
  XCircle,
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
  ["可能只看檔名", "比對檔案內容與目錄樹"],
  ["可能直接刪除", "預設移至垃圾桶"],
  ["黑盒操作", "完整路徑、預覽與 CSV 稽核"],
  ["可能跨專案誤判", "專案與套件環境硬性排除"],
  ["無法驗證宣稱", "免費且完全開源"],
] as const;

const questions = [
  { question: "DUPESPACE 的用途是什麼？", answer: "用來搜尋、檢查並安全清理 Windows 與 Google Drive 中內容完全相同的重複檔案與重複資料夾，協助回收儲存空間。" },
  { question: "重複資料夾會怎麼處理？", answer: "只有相對路徑、檔案大小與每個內容校驗碼都一致的完整鏡像才會列出。資料夾只能移至垃圾桶，不能永久刪除；操作前內容若有變更會立即取消。" },
  { question: "不同專案中的相同設定檔會被處理嗎？", answer: "不會。Git、SVN、常見建置專案、套件目錄與虛擬環境會被硬性排除，不列為候選。" },
  { question: "Google Drive 檔案內容會上傳嗎？", answer: "不會。比對只使用 Google Drive API 提供的必要中繼資料與校驗碼，檔案內容不會進入 DUPESPACE 伺服器。" },
] as const;

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
        <div className="intelligence-card-head"><span><TrendingUp size={18} aria-hidden="true" /></span><div><small>HEALTH TREND</small><h3>儲存健康趨勢</h3></div><strong><CountUp from={28} to={98} /><small>/100</small></strong></div>
        <div className="trend-visual" aria-label="整理後健康指標由 28 分提升至 98 分">
          <svg viewBox="0 0 620 190" role="img" aria-hidden="true">
            <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14b8a6" stopOpacity=".38" /><stop offset="1" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
            <path className="trend-gridline" d="M0 42H620M0 96H620M0 150H620" />
            <motion.path className="trend-area" d="M0 154 C70 150 94 137 142 140 S225 126 270 130 S350 102 394 105 S469 58 515 68 S574 28 620 22 V190 H0Z" initial={reducedMotion ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: .8, delay: .3 }} />
            <motion.path className="trend-line" d="M0 154 C70 150 94 137 142 140 S225 126 270 130 S350 102 394 105 S469 58 515 68 S574 28 620 22" initial={reducedMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.25, delay: .2, ease: "easeOut" }} />
          </svg>
          <div className="trend-labels"><span>首次掃描</span><span>最近一次清理</span></div>
        </div>
        <div className="trend-summary"><span><CheckCircle2 size={15} aria-hidden="true" />已回收 <b>18.6 GB</b></span><span>最近 30 天 <b>+70</b></span></div>
      </motion.article>

      <motion.article className="intelligence-card cause-card" variants={reveal}>
        <div className="intelligence-card-head"><span><BarChart3 size={18} aria-hidden="true" /></span><div><small>CAUSE ANALYSIS</small><h3>重複成因分析</h3></div></div>
        <p>以本機路徑線索分類，只保留彙總比例。</p>
        <div className="cause-bars">
          {causes.map((cause, index) => <div key={cause.label}><div><span>{cause.label}</span><b>{cause.value}%</b></div><i><motion.em className={cause.color} initial={reducedMotion ? { width: `${cause.value}%` } : { width: 0 }} whileInView={{ width: `${cause.value}%` }} viewport={{ once: true }} transition={{ duration: .7, delay: .28 + index * .1, ease: [0.22, 1, 0.36, 1] }} /></i></div>)}
        </div>
      </motion.article>

      <motion.article className="intelligence-card profile-card" variants={reveal}>
        <div className="intelligence-card-head"><span><ShieldCheck size={18} aria-hidden="true" /></span><div><small>PROTECTED PROFILES</small><h3>自訂防護設定檔</h3></div><em>啟用中</em></div>
        <p>把常用保護規則留在裝置端，下次掃描自動套用。</p>
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
      <div className="privacy-flow-title"><span><Lock size={18} aria-hidden="true" /></span><div><small>DATA BOUNDARY</small><b>只有必要中繼資料通過</b></div></div>
      <div className="privacy-flow" aria-label="Google Drive 檔案內容不離開雲端硬碟，DUPESPACE 只接收必要中繼資料">
        <div className="flow-node"><Cloud size={25} aria-hidden="true" /><b>Google Drive</b><small>檔案內容留在這裡</small></div>
        <div className="flow-route"><span>ID · 大小 · 校驗碼</span><i /><motion.em animate={reducedMotion ? undefined : { left: ["8%", "88%"], opacity: [0, 1, 1, 0] }} transition={{ duration: 2.7, repeat: Infinity, repeatDelay: .7, ease: "easeInOut" }} /></div>
        <div className="flow-node safe"><ShieldCheck size={25} aria-hidden="true" /><b>DUPESPACE</b><small>僅執行使用者要求</small></div>
      </div>
      <div className="content-stays"><FileCheck2 size={18} aria-hidden="true" /><span><b>檔案內容不傳輸</b><small>不出售、不用於廣告個人化，也不提供給 AdSense</small></span></div>
      <div className="privacy-badges"><span><Lock size={13} aria-hidden="true" /> Secure Cookie</span><span><Database size={13} aria-hidden="true" /> 最少資料</span><span><ShieldCheck size={13} aria-hidden="true" /> Limited Use</span></div>
      <div className="limited-use-copy"><b>Google Limited Use 承諾</b><p>DUPESPACE 對 Google API 使用者資料的使用遵守 Google API Services User Data Policy 及 Limited Use 要求。資料不出售、不提供給 AdSense、不用於廣告個人化。加密的 Secure、HttpOnly Cookie 最多維持登入 30 天；登出時撤銷 Google 權杖並清除工作階段。</p></div>
    </motion.div>
  );
}

export function TrustMatrixMotion({ repository }: { repository: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div className="trust-motion-layout" initial={reducedMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: .18 }} variants={{ visible: { transition: { staggerChildren: .085 } } }}>
      <div className="trust-table trust-table-motion" role="table" aria-label="傳統清理工具與 DUPESPACE 比較">
        <motion.div role="row" variants={reveal}><b role="columnheader"><AlertTriangle size={17} aria-hidden="true" />傳統清理工具</b><b role="columnheader"><ShieldCheck size={17} aria-hidden="true" />DUPESPACE</b></motion.div>
        {comparisons.map(([legacy, dupespace]) => <motion.div role="row" variants={reveal} key={legacy}><span><XCircle size={17} aria-hidden="true" />{legacy}</span><span><CheckCircle2 size={17} aria-hidden="true" />{dupespace}</span></motion.div>)}
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
