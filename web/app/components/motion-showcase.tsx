"use client";

import {
  ArrowRight,
  Clock3,
  Code2,
  Files,
  HardDriveDownload,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

const safetyCards: Array<{ icon: LucideIcon; eyebrow: string; title: string; body: string }> = [
  { icon: ShieldCheck, eyebrow: "01 · READ ONLY", title: "先比較，不動檔案", body: "網頁不會複製、覆蓋或刪除檔案，只整理可以檢查與匯出的比較結果。" },
  { icon: Files, eyebrow: "02 · CONTENT MATCH", title: "改名也能找出相同內容", body: "即使名稱或位置不同，仍能找出相同檔案；相同位置卻有不同內容時，會另外標示版本衝突。" },
  { icon: Code2, eyebrow: "03 · CONTEXT AWARE", title: "需要你決定的項目會標出", body: "遇到專案、程式或備份檔案時會提醒你多看一眼，不會把內容相同直接當成刪除建議。" },
  { icon: Clock3, eyebrow: "04 · FAIL CLOSED", title: "檔案變更就停止", body: "比較期間會再次確認檔案狀態；檔案被修改或無法完整讀取時，會安全停止並說明下一步。" },
];

const workflowSteps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: ScanSearch, title: "選擇", body: "選擇要搬入與要保留的資料夾" },
  { icon: Files, title: "比較", body: "從內容找出改名或搬移過的相同檔案" },
  { icon: ListChecks, title: "決定", body: "看清楚差異後，再決定怎麼合併" },
];

function setGlow(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
}

function MagneticLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 320, damping: 24 });
  const springY = useSpring(y, { stiffness: 320, damping: 24 });

  function move(event: PointerEvent<HTMLAnchorElement>) {
    setGlow(event);
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * .045);
    y.set((event.clientY - rect.top - rect.height / 2) * .07);
  }

  return <motion.a href={href} className={`${className} magnetic-surface`} style={{ x: springX, y: springY }} onPointerMove={move} onPointerLeave={() => { x.set(0); y.set(0); }}>{children}</motion.a>;
}

export function MotionHeroActions() {
  return (
    <div className="hero-actions">
      <MagneticLink className="button primary hero-primary" href="/merge"><span>比較兩個資料夾</span><ArrowRight size={18} aria-hidden="true" /></MagneticLink>
      <MagneticLink className="button secondary" href="/download"><HardDriveDownload size={18} aria-hidden="true" /><span>下載 Windows 清理工具</span></MagneticLink>
    </div>
  );
}

function SafetyCard({ data }: { data: (typeof safetyCards)[number] }) {
  const { icon: Icon, eyebrow, title, body } = data;
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 26 });
  const springY = useSpring(y, { stiffness: 280, damping: 26 });

  function move(event: PointerEvent<HTMLElement>) {
    setGlow(event);
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * .022);
    y.set((event.clientY - rect.top - rect.height / 2) * .022);
  }

  return (
    <motion.article
      className="magnetic-surface"
      style={{ x: springX, y: springY }}
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 170, damping: 22 } } }}
      onPointerMove={move}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      <motion.span className="pillar-icon" whileHover={reducedMotion ? undefined : { y: -3 }} transition={{ type: "spring", stiffness: 420, damping: 16 }}><Icon size={22} aria-hidden="true" /></motion.span>
      <b>{eyebrow}</b><h3>{title}</h3><p>{body}</p>
    </motion.article>
  );
}

export function SafetyMotionGrid() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div className="safety-grid bento-grid" initial={reducedMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
      {safetyCards.map((card) => <SafetyCard key={card.eyebrow} data={card} />)}
    </motion.div>
  );
}

export function HowItWorksMotion() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.ol
      className="steps motion-steps"
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={{ visible: { transition: { staggerChildren: 0.14, delayChildren: 0.08 } } }}
    >
      {workflowSteps.map(({ icon: Icon, title, body }, index) => (
        <motion.li
          key={title}
          variants={{
            hidden: { opacity: 0, x: 38 },
            visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 150, damping: 22 } },
          }}
        >
          <span className="step-number" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
          <div><small className="step-index">0{index + 1}</small><b>{title}</b><small>{body}</small></div>
          {index < workflowSteps.length - 1 && <i className="step-connector" aria-hidden="true" />}
        </motion.li>
      ))}
    </motion.ol>
  );
}
