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
  capabilities?: { canTrash?: boolean; canDelete?: boolean };
  webViewLink?: string;
}

interface ProofPayload {
  id: string;
  version: string;
  checksum: string;
  size: string;
  modifiedTime: string;
  mimeType: string;
  keeperId: string;
  keeperVersion: string;
  keeperChecksum: string;
  keeperModifiedTime: string;
  expiresAt: number;
}

type OperationMode = "trash" | "permanent";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SESSION_COOKIE = "dupespace_session";
const OAUTH_COOKIE = "dupespace_oauth";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const FILE_FIELDS = [
  "id", "name", "mimeType", "size", "md5Checksum", "sha256Checksum", "createdTime",
  "modifiedTime", "ownedByMe", "version", "trashed", "capabilities(canTrash,canDelete)",
  "webViewLink",
].join(",");
const MINIMUM_AUTO_SELECT_BYTES = 1024 * 1024;

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

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("來源驗證失敗，未執行操作");
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

function constantTimeEqual(left: string, right: string): boolean {
  const a = textEncoder.encode(left);
  const b = textEncoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function proof(payload: ProofPayload, secret: string): Promise<string> {
  const encoded = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

async function verifyProof(value: string, secret: string): Promise<ProofPayload | null> {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !constantTimeEqual(await hmac(encoded, secret), signature)) return null;
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
    throw new Error("Google OAuth 尚未完成正式環境設定");
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
  if (!response.ok) throw new Error("Google 登入憑證更新失敗，請重新連線");
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

function unsupportedType(file: DriveFile): boolean {
  return file.mimeType === "application/vnd.google-apps.folder" ||
    file.mimeType === "application/vnd.google-apps.shortcut";
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
      fields: `nextPageToken,incompleteSearch,files(${FILE_FIELDS})`,
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleFetch(session, `https://www.googleapis.com/drive/v3/files?${query}`);
    if (!response.ok) throw new Error(`Google Drive 掃描失敗（${response.status}）`);
    const page = (await response.json()) as { nextPageToken?: string; files?: DriveFile[] };
    for (const file of page.files ?? []) {
      examined += 1;
      if (
        unsupportedType(file) || !file.ownedByMe || !file.size || Number(file.size) === 0 || !checksum(file) ||
        (!file.capabilities?.canTrash && !file.capabilities?.canDelete)
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
  requireSameOrigin(request);
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
        const keeperDigest = checksum(keeper) ?? "";
        const output = await Promise.all(records.map(async (file) => ({
          id: file.id,
          name: file.name,
          size: Number(file.size),
          checksum: checksum(file),
          version: file.version ?? "",
          mimeType: file.mimeType,
          createdTime: file.createdTime ?? null,
          modifiedTime: file.modifiedTime ?? null,
          webViewLink: file.webViewLink ?? null,
          canTrash: Boolean(file.capabilities?.canTrash),
          canDelete: Boolean(file.capabilities?.canDelete),
          autoSelectable: Boolean(file.capabilities?.canTrash) && Number(file.size) >= MINIMUM_AUTO_SELECT_BYTES,
          keeper: file.id === keeper.id,
          proof: await proof({
            id: file.id,
            version: file.version ?? "",
            checksum: checksum(file) ?? "",
            size: file.size,
            modifiedTime: file.modifiedTime ?? "",
            mimeType: file.mimeType,
            keeperId: keeper.id,
            keeperVersion: keeper.version ?? "",
            keeperChecksum: keeperDigest,
            keeperModifiedTime: keeper.modifiedTime ?? "",
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
  return json({
    examined,
    skipped,
    duplicateCopies: groups.reduce((total, group) => total + group.records.length - 1, 0),
    reclaimableBytes: groups.reduce((total, group) => total + group.reclaimableBytes, 0),
    groups,
    storageQuota: about.storageQuota ?? null,
    user: about.user ?? null,
    proofExpiresAt: expiresAt,
  }, 200, setCookie ? { "set-cookie": setCookie } : undefined);
}

async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      result[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return result;
}

async function getFile(session: OAuthSession, id: string): Promise<DriveFile> {
  const response = await googleFetch(
    session,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS)}&supportsAllDrives=false`,
  );
  if (!response.ok) throw new Error(`無法重新驗證檔案（${response.status}）`);
  return response.json() as Promise<DriveFile>;
}

function validateSnapshot(file: DriveFile, payload: ProofPayload, mode: OperationMode): string | null {
  if (file.id !== payload.id || file.trashed || !file.ownedByMe) return "檔案已移動、刪除或不再由你擁有";
  if (unsupportedType(file) || file.mimeType !== payload.mimeType) return "資料夾、捷徑或檔案類型變更，已跳過";
  if (file.version !== payload.version || file.modifiedTime !== payload.modifiedTime) return "檔案版本或修改時間已變更";
  if (file.size !== payload.size || checksum(file) !== payload.checksum) return "檔案大小或校驗碼已變更";
  if (mode === "trash" && !file.capabilities?.canTrash) return "沒有移至垃圾桶權限";
  if (mode === "permanent" && !file.capabilities?.canDelete) return "沒有永久刪除權限";
  return null;
}

function validateKeeper(file: DriveFile, payload: ProofPayload): string | null {
  if (file.id !== payload.keeperId || file.trashed || !file.ownedByMe) return "保留檔案已移動、刪除或不再由你擁有";
  if (unsupportedType(file)) return "保留項目不是可驗證的一般檔案";
  if (file.version !== payload.keeperVersion || file.modifiedTime !== payload.keeperModifiedTime) return "保留檔案版本已變更";
  if (file.size !== payload.size || checksum(file) !== payload.keeperChecksum) return "保留檔案內容已變更";
  return null;
}

function auditOutcome(
  payload: ProofPayload,
  file: DriveFile | null,
  mode: OperationMode,
  status: "trashed" | "deleted" | "failed" | "skipped",
  reason: string,
) {
  return {
    timestamp: new Date().toISOString(),
    id: payload.id,
    name: file?.name ?? "",
    size: Number(payload.size),
    checksum: payload.checksum,
    operationMode: mode,
    status,
    reason,
  };
}

async function mutate(request: Request, env: Required<GoogleDriveEnv>, mode: OperationMode): Promise<Response> {
  requireSameOrigin(request);
  const { session, setCookie } = await authorizedSession(request, env);
  const body = await request.json() as { items?: Array<{ id?: string; proof?: string }> };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    return json({ error: "每批必須包含 1 至 100 個檔案" }, 400);
  }
  const verified = await Promise.all(body.items.map(async (item) => {
    const payload = item.proof ? await verifyProof(item.proof, env.SESSION_SECRET) : null;
    return payload && payload.id === item.id && payload.id !== payload.keeperId ? payload : null;
  }));
  if (verified.some((item) => item === null)) return json({ error: "掃描證明無效或已過期，請重新掃描" }, 409);

  const outcomes = await mapConcurrent(verified as ProofPayload[], 4, async (payload) => {
    let current: DriveFile | null = null;
    try {
      const [target, keeper] = await Promise.all([
        getFile(session, payload.id),
        getFile(session, payload.keeperId),
      ]);
      current = target;
      const targetFailure = validateSnapshot(target, payload, mode);
      if (targetFailure) return auditOutcome(payload, target, mode, "skipped", targetFailure);
      const keeperFailure = validateKeeper(keeper, payload);
      if (keeperFailure) return auditOutcome(payload, target, mode, "skipped", keeperFailure);

      const endpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(payload.id)}?supportsAllDrives=false`;
      const response = mode === "trash"
        ? await googleFetch(session, `${endpoint}&fields=id,trashed`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        })
        : await googleFetch(session, endpoint, { method: "DELETE" });
      if (!response.ok) return auditOutcome(payload, target, mode, "failed", `Google Drive API 回覆 ${response.status}`);
      return auditOutcome(
        payload,
        target,
        mode,
        mode === "trash" ? "trashed" : "deleted",
        mode === "trash" ? "已移至 Google Drive 垃圾桶" : "已永久刪除，無法復原",
      );
    } catch (error) {
      return auditOutcome(payload, current, mode, "failed", error instanceof Error ? error.message : "未知錯誤");
    }
  });
  return json({ operationMode: mode, outcomes }, 200, setCookie ? { "set-cookie": setCookie } : undefined);
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
      requireSameOrigin(request);
      return json({ connected: false }, 200, { "set-cookie": clearCookie(SESSION_COOKIE, request) });
    }
    if (url.pathname === "/api/google/scan" && request.method === "POST") return scan(request, env);
    if (url.pathname === "/api/google/trash" && request.method === "POST") return mutate(request, env, "trash");
    if (url.pathname === "/api/google/delete" && request.method === "POST") return mutate(request, env, "permanent");
    return json({ error: "找不到 API 路徑" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器處理失敗";
    const status = message.includes("登入") ? 401 : message.includes("設定") ? 503 : message.includes("來源") ? 403 : 500;
    return json({ error: message }, status);
  }
}
