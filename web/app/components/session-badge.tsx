"use client";

import { Cloud, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

type SessionState = {
  connected: boolean;
  configured: boolean;
  user?: { displayName?: string; emailAddress?: string };
};

export function SessionBadge() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((value: unknown) => {
        if (!value || typeof value !== "object") return;
        const candidate = value as Record<string, unknown>;
        const user = candidate.user && typeof candidate.user === "object" ? candidate.user as Record<string, unknown> : undefined;
        setSession({
          connected: candidate.connected === true,
          configured: candidate.configured !== false,
          user: user ? {
            displayName: typeof user.displayName === "string" ? user.displayName : undefined,
            emailAddress: typeof user.emailAddress === "string" ? user.emailAddress : undefined,
          } : undefined,
        });
      })
      .catch(() => setSession({ connected: false, configured: true }));
  }, []);

  async function disconnect() {
    await fetch("/api/google/disconnect", { method: "POST", credentials: "same-origin" });
    setSession({ connected: false, configured: true });
    window.location.assign("/");
  }

  if (!session?.connected) return null;

  return (
    <div className="session-badge" aria-label={`Google Drive 已連線 ${session.user?.emailAddress ?? ""}`}>
      <span className="session-indicator"><Cloud size={14} aria-hidden="true" /></span>
      <span><b>Google Drive 已連線</b><small>{session.user?.emailAddress ?? session.user?.displayName ?? "已驗證帳號"}</small></span>
      <button type="button" onClick={disconnect} aria-label="中斷 Google Drive 連線"><LogOut size={14} aria-hidden="true" /><span>中斷</span></button>
    </div>
  );
}
