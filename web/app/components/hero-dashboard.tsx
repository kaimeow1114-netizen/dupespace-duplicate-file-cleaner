"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Copy, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const files = [
  { name: "海邊.jpg", path: "旅行相片 / 2025 / 海邊.jpg", keeper: true },
  { name: "海邊.jpg", path: "備份整理 / 海邊.jpg", keeper: false },
  { name: "報告-final.pdf", path: "文件 / 報告-final.pdf", keeper: true },
  { name: "報告-final (1).pdf", path: "下載 / 報告-final (1).pdf", keeper: false },
] as const;

const particles = [
  [8, 18, 1.6, 0], [17, 72, 1.1, .35], [26, 42, 1.4, .7], [34, 84, 1, 1.05],
  [43, 26, 1.7, 1.4], [51, 62, 1.2, 1.75], [61, 13, 1.1, 2.1], [69, 76, 1.5, 2.45],
  [77, 38, 1.2, 2.8], [87, 66, 1.7, 3.15], [94, 22, 1, 3.5],
] as const;

export function HeroDashboard() {
  const reducedMotion = useReducedMotion();
  const [score, setScore] = useState(reducedMotion ? 28 : 0);
  const [cleaned, setCleaned] = useState(false);
  const [savings, setSavings] = useState(reducedMotion ? 18.6 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    let scoreControl = animate(0, 28, { duration: .9, delay: .55, onUpdate: (value) => setScore(Math.round(value)) });
    const savingsControl = animate(0, 18.6, { duration: 1.1, delay: 1, ease: [0.2, 0.8, 0.2, 1], onUpdate: setSavings });
    const cleanTimer = window.setTimeout(() => {
      setCleaned(true);
      scoreControl = animate(28, 98, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (value) => setScore(Math.round(value)) });
    }, 4300);
    return () => {
      scoreControl.stop();
      savingsControl.stop();
      window.clearTimeout(cleanTimer);
    };
  }, [reducedMotion]);

  const ring = 2 * Math.PI * 47;
  const urgent = score < 40;

  return (
    <motion.div
      className="dashboard-demo magnetic-surface"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 28 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 145, damping: 18, mass: 0.85 }}
      aria-label="DUPESPACE 儲存空間健康與重複檔案掃描儀表板示意"
    >
      <svg className="hash-particles" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 79 C26 48 35 64 52 35 S80 25 98 9" />
        <path d="M4 28 C24 9 45 38 62 18 S86 43 98 25" />
        {particles.map(([cx, cy, radius, delay], index) => (
          <motion.circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={radius} initial={{ opacity: .15 }} animate={reducedMotion ? { opacity: .28 } : { opacity: [.12, .72, .16], x: [0, index % 2 ? -5 : 7, 0], y: [0, index % 3 ? -8 : 6, 0] }} transition={{ duration: 4.2 + (index % 4) * .7, delay, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }} />
        ))}
      </svg>
      <div className="dashboard-titlebar"><span /><span /><span /><b>DUPESPACE · STORAGE INTELLIGENCE</b><em><ShieldCheck size={12} aria-hidden="true" /> 安全模式</em></div>
      <div className="dashboard-body">
        <div className="health-demo-grid">
          <div className={`health-ring ${urgent ? "critical" : "optimal"}`}>
            <svg viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="47" /><motion.circle cx="54" cy="54" r="47" strokeDasharray={ring} animate={{ strokeDashoffset: ring * (1 - score / 100) }} transition={{ duration: .5, ease: "easeOut" }} /></svg>
            <div><strong>{score}</strong><small>/100</small></div>
          </div>
          <div className="health-demo-copy">
            <small>空間健康指數 · 整理指標</small>
            <b>{urgent ? "發現實質重複項目" : "重複項目已完成整理"}</b>
            <span>{urgent ? <AlertTriangle size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}{urgent ? "建議檢查並安全清理" : "儲存狀態極佳"}</span>
          </div>
        </div>
        <div className="scan-heading"><div><small>SHA-256 CONTENT SCAN</small><b>{cleaned ? "安全清理完成" : "正在精確比對內容"}</b></div><strong>{cleaned ? "100%" : "82%"}</strong></div>
        <div className="scan-progress"><motion.i initial={{ width: 0 }} animate={{ width: cleaned ? "100%" : "82%" }} transition={{ duration: reducedMotion ? 0 : 1.1 }} /></div>
        <div className="hash-stream" aria-hidden="true"><span>SHA-256</span><i>8f14e45fceea...</i><i>c9f0f895fb98...</i><i>45c48cce2e2d...</i></div>
        <div className="dashboard-columns"><span>保留區 · PROTECTED</span><span>待清理副本 · DUPLICATE</span></div>
        <div className="dashboard-files">
          {files.map((file, index) => <motion.div key={file.path} className={`demo-file ${file.keeper ? "safe" : "duplicate"} ${cleaned && !file.keeper ? "cleaned" : ""}`} initial={reducedMotion ? false : { opacity: 0, x: index % 2 ? 14 : -14 }} animate={{ opacity: cleaned && !file.keeper ? .5 : 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : .45 + index * .09 }}><i>{file.keeper ? <ShieldCheck size={15} aria-hidden="true" /> : cleaned ? <CheckCircle2 size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}</i><span><b>{file.name}</b><small>{file.path}</small></span><em>{file.keeper ? "保留" : cleaned ? "已回收" : "待清"}</em></motion.div>)}
        </div>
        <div className="dashboard-savings"><div><small>儀表板示意 · 可安全釋放</small><strong>{savings.toFixed(1)} GB</strong></div><span>{cleaned ? <Sparkles size={18} aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}<small>{cleaned ? "已移至垃圾桶" : "每組保留一份"}</small></span></div>
      </div>
    </motion.div>
  );
}
