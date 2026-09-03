"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const legacyLocalKeys = ["dupespace-health-history-v3", "dupespace-protected-profile", "dupespace-roi-plan-v2", "dupespace-index-epoch"];

export function LegacyCleanerRetirement({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  const en = locale === "en";
  const destination = en ? "/en/local/" : "/local";
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function migrate() {
      const timeout = window.setTimeout(() => controller.abort(), 6500);
      try { await fetch("/api/google/disconnect", { method: "POST", headers: { "x-dupespace-migration": "v2" }, signal: controller.signal }); } catch { /* An unavailable network cannot block the read-only replacement. */ }
      finally { window.clearTimeout(timeout); }
      try {
        for (const key of legacyLocalKeys) localStorage.removeItem(key);
        indexedDB.deleteDatabase("dupespace-drive-index-v1");
      } catch { /* Browser storage may be disabled. */ }
      if (!active) return;
      setReady(true);
      window.location.replace(destination);
    }
    void migrate();
    return () => { active = false; controller.abort(); };
  }, [destination]);
  return <main className="retirement-page" lang={en ? "en" : "zh-TW"}><div><span>{ready ? <ShieldCheck size={26} aria-hidden="true" /> : <LoaderCircle className="retirement-spinner" size={26} aria-hidden="true" />}</span><h1>{en ? "Opening the new local analyzer" : "正在開啟新版本機分析器"}</h1><p>{en ? "DUPESPACE is clearing the previous cloud session from this browser before continuing." : "DUPESPACE 正在清除這個瀏覽器的舊版雲端工作階段，再安全前往本機分析功能。 "}</p><a className="button primary" href={destination}>{en ? "Continue now" : "立即繼續"}</a></div></main>;
}
