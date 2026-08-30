"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString() }: { value: number; format?: (value: number) => string }) {
  const reduced = useReducedMotion();
  const current = useRef(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const animation = animate(current.current, value, {
      duration: reduced ? 0 : 1,
      ease: "easeOut",
      onUpdate: (next) => { current.current = next; setDisplay(next); },
    });
    return () => animation.stop();
  }, [value, reduced]);
  return <span aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}
