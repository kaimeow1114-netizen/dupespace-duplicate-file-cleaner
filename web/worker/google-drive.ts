export interface GoogleDriveEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

interface OAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  md5Checksum?: string;
  sha256Checksum?: string;
  createdTime?: string;
  modifiedTime?: string;
  ownedByMe?: boolean;
  version?: string;
  trashed?: boolean;
  capabilities?: { canTrash?: boolean };
  webViewLink?: string;
}

interface ProofPayload {
  id: string;
  version: string;
  checksum: string;
  size: string;
  keeperId: string;
  keeperVersion: string;
  expiresAt: number;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SESSION_COOKIE = "dupesweep_session";
const OAUTH_COOKIE = "dupesweep_oauth";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return encodeBase64Url(buffer);
}

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

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: unknown, secret: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secret),
    textEncoder.encode(JSON.stringify(value)),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return encodeBase64Url(combined);
}

async function decrypt<T>(value: string | undefined, secret: string): Promise<T | null> {
  if (!value) return null;
  try {
    const combined = decodeBase64Url(value);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      await aesKey(secret),
      combined.slice(12),
    );
    return JSON.parse(textDecoder.decode(decrypted)) as T;
  } catch {
    return null;
  }
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value))));
}

async function proof(payload: ProofPayload, secret: string): Promise<string> {
  const encoded = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

async function verifyProof(value: string, secret: string): Promise<ProofPayload | null> {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || (await hmac(encoded, secret)) !== signature) return null;
  try {
    const payload = JSON.parse(textDecoder.decode(decodeBase64Url(encoded))) as ProofPayload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function requireConfig(env: GoogleDriveEnv): asserts env is Required<GoogleDriveEnv> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    throw new Error("Google OAuth 尚未完成網站設定");
  }
  if (env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET 必須至少 32 個字元");
}

function redirectUri(request: Request): string {
  return `${new URL(request.url).origin}/api/google/callback`;
}

async function refreshSession(session: OAuthSession, env: Required<GoogleDriveEnv>): Promise<OAuthSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) throw new Error("Google 登入已過期，請重新連線");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google 登入權杖更新失敗");
  const tokens = (await response.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: tokens.access_token,
    refreshToken: session.refreshToken,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
}

async function authorizedSession(request: Request, env: Required<GoogleDriveEnv>): Promise<{ session: OAuthSession; setCookie?: string }> {
  const current = await decrypt<OAuthSession>(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
  if (!current) throw new Error("請先登入 Google Drive");
  const refreshed = await refreshSession(current, env);
  return {
    session: refreshed,
    setCookie: refreshed.accessToken === current.accessToken
      ? undefined
      : cookie(SESSION_COOKIE, await encrypt(refreshed, env.SESSION_SECRET), request, 30 * 86400),
  };
}

async function googleFetch(session: OAuthSession, url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.accessToken}`);
  return fetch(url, { ...init, headers });
}

function checksum(file: DriveFile): string | null {
  if (file.sha256Checksum) return `sha256:${file.sha256Checksum}`;
  if (file.md5Checksum) return `md5:${file.md5Checksum}`;
  return null;
}

function keeperRank(file: DriveFile): [number, string, string] {
  const timestamp = Date.parse(file.createdTime ?? file.modifiedTime ?? "9999-12-31T23:59:59Z");
  return [Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER, file.name.toLocaleLowerCase(), file.id];
}

function compareRank(left: DriveFile, right: DriveFile): number {
  const a = keeperRank(left);
  const b = keeperRank(right);
  return a[0] - b[0] || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
}

async function listDrive(session: OAuthSession): Promise<{ files: DriveFile[]; examined: number; skipped: number }> {
  const files: DriveFile[] = [];
  let examined = 0;
  let skipped = 0;
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      q: "trashed = false",
      spaces: "drive",
      corpora: "user",
      pageSize: "1000",
      fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,sha256Checksum,createdTime,modifiedTime,ownedByMe,version,trashed,capabilities(canTrash),webViewLink)",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleFetch(session, `https://www.googleapis.com/drive/v3/files?${query}`);
    if (!response.ok) throw new Error(`Google Drive 掃描失敗（${response.status}）`);
    const page = (await response.json()) as { nextPageToken?: string; files?: DriveFile[] };
    for (const file of page.files ?? []) {
      examined += 1;
      const digest = checksum(file);
      if (
        file.mimeType === "application/vnd.google-apps.folder" ||
        file.mimeType === "application/vnd.google-apps.shortcut" ||
        !file.ownedByMe ||
        !file.capabilities?.canTrash ||
        !file.size ||
        !digest
      ) {
        skipped += 1;
        continue;
      }
      files.push(file);
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return { files, examined, skipped };
}

async function scan(request: Request, env: Required<GoogleDriveEnv>): Promise<Response> {
  const { session, setCookie } = await authorizedSession(request, env);
  const [{ files, examined, skipped }, aboutResponse] = await Promise.all([
    listDrive(session),
    googleFetch(session, "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota"),
  ]);
  const about = aboutResponse.ok ? await aboutResponse.json() as {
    storageQuota?: { limit?: string; usage?: string };
    user?: { displayName?: string; emailAddress?: string; photoLink?: string };
  } : {};
  const buckets = new Map<string, DriveFile[]>();
  for (const file of files) {
    const fingerprint = `${file.size}:${checksum(file)}`;
    const bucket = buckets.get(fingerprint) ?? [];
    bucket.push(file);
    buckets.set(fingerprint, bucket);
  }
  const expiresAt = Date.now() + 30 * 60_000;
  const groups = await Promise.all(
    [...buckets.entries()]
      .filter(([, records]) => records.length > 1)
      .map(async ([fingerprint, records]) => {
        records.sort(compareRank);
        const keeper = records[0];
        const output = await Promise.all(records.map(async (file) => ({
          id: file.id,
          name: file.name,
          size: Number(file.size),
          checksum: checksum(file),
          version: file.version ?? "",
          createdTime: file.createdTime ?? null,
          modifiedTime: file.modifiedTime ?? null,
          webViewLink: file.webViewLink ?? null,
          keeper: file.id === keeper.id,
          proof: await proof({
            id: file.id,
            version: file.version ?? "",
            checksum: checksum(file) ?? "",
            size: file.size,
            keeperId: keeper.id,
            keeperVersion: keeper.version ?? "",
            expiresAt,
          }, env.SESSION_SECRET),
        })));
        return {
          fingerprint,
          reclaimableBytes: Number(keeper.size) * (records.length - 1),
          records: output,
        };
      }),
  );
  groups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes);
  const reclaimableBytes = groups.reduce((total, group) => total + group.reclaimableBytes, 0);
  return json({
    examined,
    skipped,
    duplicateCopies: groups.reduce((total, group) => total + group.records.length - 1, 0),
    reclaimableBytes,
    groups,
    storageQuota: about.storageQuota ?? null,
    user: about.user ?? null,
    proofExpiresAt: expiresAt,
  }, 200, setCookie ? { "set-cookie": setCookie } : undefined);
}

async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      result[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return result;
}

async function getFile(session: OAuthSession, id: string): Promise<DriveFile> {
  const fields = "id,name,size,md5Checksum,sha256Checksum,ownedByMe,version,trashed,capabilities(canTrash)";
  const response = await googleFetch(session, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`);
  if (!response.ok) throw new Error(`無法重新確認檔案（${response.status}）`);
  return response.json() as Promise<DriveFile>;
}

async function trash(request: Request, env: Required<GoogleDriveEnv>): Promise<Response> {
  const { session, setCookie } = await authorizedSession(request, env);
  const body = await request.json() as { items?: Array<{ id?: string; proof?: string }> };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    return json({ error: "每個批次必須包含 1 至 100 個檔案" }, 400);
  }
  const verified = await Promise.all(body.items.map(async (item) => {
    const payload = item.proof ? await verifyProof(item.proof, env.SESSION_SECRET) : null;
    return payload && payload.id === item.id && payload.id !== payload.keeperId ? payload : null;
  }));
  if (verified.some((item) => item === null)) return json({ error: "掃描證明已失效，請重新掃描" }, 409);

  const payloads = verified as ProofPayload[];
  const keeperIds = [...new Set(payloads.map((item) => item.keeperId))];
  const [selectedFiles, keeperFiles] = await Promise.all([
    mapConcurrent(payloads, 8, (item) => getFile(session, item.id)),
    mapConcurrent(keeperIds, 8, (id) => getFile(session, id)),
  ]);
  const keepers = new Map(keeperFiles.map((file) => [file.id, file]));

  const outcomes = await mapConcurrent(payloads, 6, async (payload, index) => {
    const current = selectedFiles[index];
    const keeper = keepers.get(payload.keeperId);
    if (
      current.trashed || !current.ownedByMe || !current.capabilities?.canTrash ||
      current.version !== payload.version || current.size !== payload.size || checksum(current) !== payload.checksum
    ) return { id: payload.id, status: "failed", error: "檔案在掃描後已變更，請重新掃描" };
    if (
      !keeper || keeper.trashed || !keeper.ownedByMe || keeper.version !== payload.keeperVersion ||
      keeper.size !== payload.size || checksum(keeper) !== payload.checksum
    ) return { id: payload.id, status: "failed", error: "保留副本已變更，為安全起見未移除" };
    const response = await googleFetch(
      session,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(payload.id)}?supportsAllDrives=false&fields=id,trashed`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ trashed: true }) },
    );
    if (!response.ok) return { id: payload.id, status: "failed", error: `Google Drive 回覆 ${response.status}` };
    return { id: payload.id, status: "trashed", size: Number(payload.size) };
  });
  return json({ outcomes }, 200, setCookie ? { "set-cookie": setCookie } : undefined);
}

export async function handleGoogleDriveApi(request: Request, env: GoogleDriveEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/google/")) return null;
  try {
    if (url.pathname === "/api/google/status" && request.method === "GET") {
      const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
      if (!configured) return json({ connected: false, configured: false });
      requireConfig(env);
      const session = await decrypt<OAuthSession>(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
      return json({ connected: Boolean(session), configured: true });
    }
    requireConfig(env);
    if (url.pathname === "/api/google/start" && request.method === "GET") {
      const state = randomToken();
      const verifier = randomToken(48);
      const challenge = encodeBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(verifier))));
      const oauthCookie = await encrypt({ state, verifier }, env.SESSION_SECRET);
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri(request),
        response_type: "code",
        scope: `openid email ${DRIVE_SCOPE}`,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return new Response(null, {
        status: 302,
        headers: {
          location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
          "set-cookie": cookie(OAUTH_COOKIE, oauthCookie, request, 600),
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/api/google/callback" && request.method === "GET") {
      const pending = await decrypt<{ state: string; verifier: string }>(parseCookies(request)[OAUTH_COOKIE], env.SESSION_SECRET);
      if (!pending || pending.state !== url.searchParams.get("state") || !url.searchParams.get("code")) {
        return Response.redirect(`${url.origin}/cleaner?error=oauth_state`, 302);
      }
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code: url.searchParams.get("code") ?? "",
          code_verifier: pending.verifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri(request),
        }),
      });
      if (!response.ok) return Response.redirect(`${url.origin}/cleaner?error=oauth_exchange`, 302);
      const tokens = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
      const session: OAuthSession = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      };
      const headers = new Headers({ location: `${url.origin}/cleaner?connected=1`, "cache-control": "no-store" });
      headers.append("set-cookie", cookie(SESSION_COOKIE, await encrypt(session, env.SESSION_SECRET), request, 30 * 86400));
      headers.append("set-cookie", clearCookie(OAUTH_COOKIE, request));
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === "/api/google/disconnect" && request.method === "POST") {
      return json({ connected: false }, 200, { "set-cookie": clearCookie(SESSION_COOKIE, request) });
    }
    if (url.pathname === "/api/google/scan" && request.method === "POST") return scan(request, env);
    if (url.pathname === "/api/google/trash" && request.method === "POST") return trash(request, env);
    return json({ error: "找不到端點" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";
    const status = message.includes("登入") ? 401 : message.includes("設定") ? 503 : 500;
    return json({ error: message }, status);
  }
}
