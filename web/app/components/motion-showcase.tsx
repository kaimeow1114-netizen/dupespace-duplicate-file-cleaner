"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

const safetyCards = [
  ["↙", "01 · RECOVERABLE", "預設不永久刪除", "檔案與鏡像資料夾先進 Windows 資源回收筒或 Google Drive 垃圾桶；失敗不會降級成永久刪除。"],
  ["♢", "02 · PROTECTED", "保留來源絕對保護", "Windows 採保留區對清理區的單向比對；保留區內每一份檔案與資料夾都不可勾選。"],
  ["</>", "03 · CONTEXT AWARE", "代碼專案自動排除", "Git、SVN、套件目錄、虛擬環境、程式資源、備份及同步情境不會成為整體清理候選。"],
  ["◎", "04 · REVALIDATED", "變更即中止", "操作前再次複驗 ID、權限、檔案數、容量、最新修改時間與內容校驗碼；任何變化都取消。"],
] as const;

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
      <MagneticLink className="button primary hero-primary" href="/cleaner">⚡ 立即線上清理 Google Drive <span>→</span></MagneticLink>
      <MagneticLink className="button secondary" href="/download">▣ 了解 Windows 版</MagneticLink>
    </div>
  );
}

function SafetyCard({ data }: { data: (typeof safetyCards)[number] }) {
  const [icon, eyebrow, title, body] = data;
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
      <motion.span className="pillar-icon" whileHover={reducedMotion ? undefined : { y: -3 }} transition={{ type: "spring", stiffness: 420, damping: 16 }}>{icon}</motion.span>
      <b>{eyebrow}</b><h3>{title}</h3><p>{body}</p>
    </motion.article>
  );
}

export function SafetyMotionGrid() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="safety-grid bento-grid"
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {safetyCards.map((card) => <SafetyCard key={card[1]} data={card} />)}
    </motion.div>
  );
}
