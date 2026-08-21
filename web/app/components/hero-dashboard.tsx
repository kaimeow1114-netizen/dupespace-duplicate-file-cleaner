"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const files = [
  ["旅行相片 / 2025 / 海邊.jpg", "保留", "safe"],
  ["備份整理 / 海邊.jpg", "待清", "duplicate"],
  ["文件 / 報告-final.pdf", "保留", "safe"],
  ["下載 / 報告-final (1).pdf", "待清", "duplicate"],
] as const;

const particles = [
  [8, 18, 1.6, 0], [17, 72, 1.1, .35], [26, 42, 1.4, .7], [34, 84, 1, 1.05],
  [43, 26, 1.7, 1.4], [51, 62, 1.2, 1.75], [61, 13, 1.1, 2.1], [69, 76, 1.5, 2.45],
  [77, 38, 1.2, 2.8], [87, 66, 1.7, 3.15], [94, 22, 1, 3.5],
] as const;

export function HeroDashboard() {
  const reducedMotion = useReducedMotion();
  const [savings, setSavings] = useState(reducedMotion ? 18.6 : 0);

  useEffect(() => {
    const controls = animate(0, 18.6, {
      duration: reducedMotion ? 0 : 1.1,
      delay: reducedMotion ? 0 : 1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (latest) => setSavings(latest),
    });
    return () => controls.stop();
  }, [reducedMotion]);

  return (
    <motion.div
      className="dashboard-demo magnetic-surface"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 28 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 145, damping: 18, mass: 0.85 }}
      aria-label="DUPESPACE 重複檔案掃描儀表板示意"
    >
      <svg className="hash-particles" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 79 C26 48 35 64 52 35 S80 25 98 9" />
        <path d="M4 28 C24 9 45 38 62 18 S86 43 98 25" />
        {particles.map(([cx, cy, radius, delay], index) => (
          <motion.circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={radius}
            initial={{ opacity: .15 }}
            animate={reducedMotion ? { opacity: .28 } : {
              opacity: [.12, .72, .16],
              x: [0, index % 2 ? -5 : 7, 0],
              y: [0, index % 3 ? -8 : 6, 0],
            }}
            transition={{ duration: 4.2 + (index % 4) * .7, delay, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
      <div className="dashboard-titlebar"><span /><span /><span /><b>DUPESPACE · SAFE SCAN</b><em>● 已保護</em></div>
      <div className="dashboard-body">
        <div className="scan-heading"><div><small>SCANNING CONTENT</small><b>正在比對檔案內容</b></div><strong>82%</strong></div>
        <div className="scan-progress"><motion.i initial={{ width: 0 }} animate={{ width: "82%" }} transition={{ duration: reducedMotion ? 0 : 1.7, delay: .2 }} /></div>
        <div className="hash-stream" aria-hidden="true"><span>SHA-256</span><i>8f14e45fceea…</i><i>c9f0f895fb98…</i><i>45c48cce2e2d…</i></div>
        <div className="dashboard-columns"><span>保留區 · PROTECTED</span><span>待清理副本 · REVIEW</span></div>
        <div className="dashboard-files">
          {files.map(([name, state, kind], index) => <motion.div key={name} className={`demo-file ${kind}`} initial={reducedMotion ? false : { opacity: 0, x: index % 2 ? 14 : -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : .45 + index * .09 }}><i>{kind === "safe" ? "✓" : "↙"}</i><span><b>{name.split(" / ").pop()}</b><small>{name}</small></span><em>{state}</em></motion.div>)}
        </div>
        <div className="dashboard-savings"><div><small>儀表板示意 · 預計可安全釋放</small><strong>{savings.toFixed(1)} GB</strong></div><span>每組保留一份<br />操作前再次複驗</span></div>
      </div>
    </motion.div>
  );
}
