"use client";

import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { cacheEpoch, clearDriveIndex, INDEX_CLEARED_EVENT, isSessionDisconnectEvent } from "../../lib/drive-index";

type SessionState = {
  connected: boolean;
  configured: boolean;
  user?: { displayName?: string; emailAddress?: string; photoLink?: string };
};

export function SessionBadge({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  const en = locale === "en";
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    let active = true;
    const epoch = cacheEpoch();
    const disconnected = (event: Event) => { if (isSessionDisconnectEvent(event)) { active = false; setSession(null); } };
    window.addEventListener(INDEX_CLEARED_EVENT, disconnected);
    window.addEventListener("storage", disconnected);
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((value: unknown) => {
        if (!active || cacheEpoch() !== epoch) return;
        if (!value || typeof value !== "object") return;
        const candidate = value as Record<string, unknown>;
        const user = candidate.user && typeof candidate.user === "object" ? candidate.user as Record<string, unknown> : undefined;
        setSession({
          connected: candidate.connected === true,
          configured: candidate.configured !== false,
          user: user ? {
            displayName: typeof user.displayName === "string" ? user.displayName : undefined,
            emailAddress: typeof user.emailAddress === "string" ? user.emailAddress : undefined,
            photoLink: typeof user.photoLink === "string" ? user.photoLink : undefined,
          } : undefined,
        });
      })
      .catch(() => setSession({ connected: false, configured: true }));
    return () => { active = false; window.removeEventListener(INDEX_CLEARED_EVENT, disconnected); window.removeEventListener("storage", disconnected); };
  }, []);

  async function disconnect() {
    await clearDriveIndex(true, true);
    await fetch("/api/google/disconnect", { method: "POST", credentials: "same-origin" });
    setSession({ connected: false, configured: true });
    window.location.assign(en ? "/en/" : "/");
  }

  if (!session?.connected) return null;

  return (
    <div className="session-badge" aria-label={`${en ? "Google Drive connected" : "Google Drive 已連線"} ${session.user?.emailAddress ?? ""}`}>
      <a className="session-avatar" href={en ? "/en/cleaner/" : "/cleaner"} aria-label={en ? "Open Drive cleaner" : "開啟 Google Drive 帳號與清理頁"}>
        {session.user?.photoLink ? <img src={session.user.photoLink} alt="" referrerPolicy="no-referrer" /> : <UserRound size={17} aria-hidden="true" />}{/* eslint-disable-line @next/next/no-img-element */}
      </a>
      <span className="session-copy"><b>{en ? "Google Drive connected" : "Google Drive 已連線"}</b><small>{session.user?.emailAddress ?? session.user?.displayName ?? "Google"}</small></span>
      <button type="button" onClick={disconnect} aria-label={en ? "Disconnect Google Drive" : "中斷 Google Drive 連線"}><LogOut size={14} aria-hidden="true" /><span>{en ? "Disconnect" : "中斷"}</span></button>
    </div>
  );
}
