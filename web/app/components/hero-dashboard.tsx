"use client";

import { motion, useReducedMotion } from "framer-motion";

const files = [
  ["旅行相片 / 2025 / 海邊.jpg", "保留", "safe"],
  ["備份整理 / 海邊.jpg", "待清", "duplicate"],
  ["文件 / 報告-final.pdf", "保留", "safe"],
  ["下載 / 報告-final (1).pdf", "待清", "duplicate"],
] as const;

export function HeroDashboard() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="dashboard-demo"
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .65, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label="DUPESPACE 重複檔案掃描儀表板示意"
    >
      <div className="dashboard-titlebar"><span /><span /><span /><b>DUPESPACE · SAFE SCAN</b><em>● 已保護</em></div>
      <div className="dashboard-body">
        <div className="scan-heading"><div><small>SCANNING CONTENT</small><b>正在比對檔案內容</b></div><strong>82%</strong></div>
        <div className="scan-progress"><motion.i initial={{ width: 0 }} animate={{ width: "82%" }} transition={{ duration: reducedMotion ? 0 : 1.7, delay: .2 }} /></div>
        <div className="hash-stream" aria-hidden="true"><span>SHA-256</span><i>8f14e45fceea…</i><i>c9f0f895fb98…</i><i>45c48cce2e2d…</i></div>
        <div className="dashboard-columns"><span>保留區 · PROTECTED</span><span>待清理副本 · REVIEW</span></div>
        <div className="dashboard-files">
          {files.map(([name, state, kind], index) => <motion.div key={name} className={`demo-file ${kind}`} initial={reducedMotion ? false : { opacity: 0, x: index % 2 ? 14 : -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .45 + index * .09 }}><i>{kind === "safe" ? "✓" : "↙"}</i><span><b>{name.split(" / ").pop()}</b><small>{name}</small></span><em>{state}</em></motion.div>)}
        </div>
        <div className="dashboard-savings"><div><small>預計可安全釋放</small><strong>18.6 GB</strong></div><span>每組保留一份<br />操作前再次複驗</span></div>
      </div>
    </motion.div>
  );
}

