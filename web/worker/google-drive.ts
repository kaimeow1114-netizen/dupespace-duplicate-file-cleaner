export interface GoogleDriveEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

interface LegacyOAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const sessionCookie = "dupespace_session";
const oauthCookie = "dupespace_oauth";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function parseCookies(request: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    result[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return result;
}

function cookie(name: string, value: string, request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookie(name: string, request: Request): string {
  return cookie(name, "", request, 0);
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

async function decryptLegacySession(value: string | undefined, secret: string | undefined): Promise<LegacyOAuthSession | null> {
  if (!value || !secret) return null;
  try {
    const combined = decodeBase64Url(value);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, await aesKey(secret), combined.slice(12));
    return JSON.parse(decoder.decode(decrypted)) as LegacyOAuthSession;
  } catch {
    return null;
  }
}

function json(body: unknown, status: number, request: Request, clear = false): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (clear) {
    headers.append("set-cookie", clearCookie(sessionCookie, request));
    headers.append("set-cookie", clearCookie(oauthCookie, request));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function revokeLegacySession(request: Request, env: GoogleDriveEnv): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "來源驗證失敗", retired: true }, 403, request);
  const legacy = await decryptLegacySession(parseCookies(request)[sessionCookie], env.SESSION_SECRET);
  const token = legacy?.refreshToken ?? legacy?.accessToken;
  let revoked = false;
  if (token) {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    }).catch(() => null);
    revoked = Boolean(response?.ok);
  }
  return json({ connected: false, retired: true, revoked }, 200, request, !token || revoked);
}

export async function handleGoogleDriveApi(request: Request, env: GoogleDriveEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const sessionStatus = url.pathname === "/api/auth/session" || url.pathname === "/api/google/status";
  if (!url.pathname.startsWith("/api/google/") && !sessionStatus) return null;

  if (sessionStatus && request.method === "GET") {
    return json({ connected: false, configured: false, retired: true, user: null, replacement: "/local" }, 200, request);
  }
  if (url.pathname === "/api/google/disconnect" && request.method === "POST") {
    return revokeLegacySession(request, env);
  }
  if (url.pathname === "/api/google/callback" && request.method === "GET") {
    const headers = new Headers({ location: `${url.origin}/local`, "cache-control": "no-store" });
    headers.append("set-cookie", clearCookie(oauthCookie, request));
    return new Response(null, { status: 302, headers });
  }
  return json({ error: "DUPESPACE 的託管雲端硬碟功能已停止，請改用本機分析器。", retired: true, replacement: "/local" }, 410, request);
}
