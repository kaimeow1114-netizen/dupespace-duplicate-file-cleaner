"use client";

import {
  ArrowRight,
  Clock3,
  Code2,
  HardDriveDownload,
  Files,
  ScanSearch,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

const safetyCards: Array<{ icon: LucideIcon; eyebrow: string; title: string; body: string }> = [
  { icon: Trash2, eyebrow: "01 · RECOVERABLE", title: "預設不永久刪除", body: "檔案與鏡像資料夾先進 Windows 資源回收筒或 Google Drive 垃圾桶；失敗不會降級成永久刪除。" },
  { icon: ShieldCheck, eyebrow: "02 · PROTECTED", title: "每組原檔自動保護", body: "Windows 每組鎖定最舊的一份；使用者指定的保護子資料夾也永遠不可勾選。" },
  { icon: Code2, eyebrow: "03 · CONTEXT AWARE", title: "代碼專案自動排除", body: "Git、SVN、套件目錄、虛擬環境、程式資源、備份及同步情境不會成為整體清理候選。" },
  { icon: Clock3, eyebrow: "04 · REVALIDATED", title: "變更即中止", body: "操作前再次複驗 ID、權限、檔案數、容量、最新修改時間與內容校驗碼；任何變化都取消。" },
];

const workflowSteps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: ScanSearch, title: "掃描", body: "只讀取比對需要的中繼資料與校驗碼" },
  { icon: Files, title: "檢查", body: "查看完整路徑、預覽與雙樹鏡像差異" },
  { icon: Trash2, title: "回收空間", body: "預設移至垃圾桶，保留復原機會" },
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
      <MagneticLink className="button primary hero-primary" href="/cleaner"><span>開始極速安全掃描</span><ArrowRight size={18} aria-hidden="true" /></MagneticLink>
      <MagneticLink className="button secondary" href="/download"><HardDriveDownload size={18} aria-hidden="true" /><span>下載 Windows 用戶端</span></MagneticLink>
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
