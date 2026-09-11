"use client";

import {
  ArrowRight,
  Clock3,
  Code2,
  Files,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

const safetyCards: Array<{ icon: LucideIcon; eyebrow: string; title: string; body: string }> = [
  { icon: ShieldCheck, eyebrow: "01 · READ ONLY", title: "先核對，不動檔案", body: "網頁不複製、不覆蓋也不刪除檔案，只建立合併前可以檢查與匯出的差異地圖。" },
  { icon: Files, eyebrow: "02 · CONTENT MATCH", title: "改名也能找出相同內容", body: "不同檔名與不同位置不會遮住重複內容；同一路徑但內容不同則獨立標示為版本衝突。" },
  { icon: Code2, eyebrow: "03 · CONTEXT AWARE", title: "用途風險明確標示", body: "偵測專案、套件、程式與備份情境；位元相同仍可能各有用途，不會把它當成刪除建議。" },
  { icon: Clock3, eyebrow: "04 · FAIL CLOSED", title: "檔案變更就停止", body: "核對期間重新檢查大小與修改時間；檔案被改動或讀取不完整時立即停止，不回傳不完整結論。" },
];

const workflowSteps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: ScanSearch, title: "選擇", body: "指定待合併與目的資料夾" },
  { icon: Files, title: "核對", body: "完整內容找出改名與搬移檔案" },
  { icon: ListChecks, title: "判讀", body: "先檢查合併地圖，再自行決定動作" },
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
      <MagneticLink className="button primary hero-primary" href="/merge"><span>合併資料夾前先核對</span><ArrowRight size={18} aria-hidden="true" /></MagneticLink>
      <MagneticLink className="button secondary" href="/local"><ScanSearch size={18} aria-hidden="true" /><span>搜尋單一資料夾重複檔</span></MagneticLink>
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
