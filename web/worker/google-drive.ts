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
  size?: string;
  md5Checksum?: string;
  sha256Checksum?: string;
  createdTime?: string;
  modifiedTime?: string;
  ownedByMe?: boolean;
  version?: string;
  trashed?: boolean;
  capabilities?: { canTrash?: boolean; canDelete?: boolean };
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  driveId?: string;
  shared?: boolean;
}

interface DriveUser {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

interface ProofPayload {
  id: string;
  version: string;
  checksum: string;
  size: string;
  modifiedTime: string;
  mimeType: string;
  parents: string[];
  path: string;
  keeperId: string;
  keeperVersion: string;
  keeperChecksum: string;
  keeperModifiedTime: string;
  keeperParents: string[];
  itemKind: "file" | "folder";
  entryCount: number;
  ignoredMetadataCount: number;
  systemMetadataIgnored: boolean;
  keeperSize: string;
  keeperEntryCount: number;
  keeperIgnoredMetadataCount: number;
  expiresAt: number;
}

type OperationMode = "trash" | "permanent";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SESSION_COOKIE = "dupespace_session";
const OAUTH_COOKIE = "dupespace_oauth";
const SESSION_MAX_AGE_SECONDS = 30 * 86400;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const FILE_FIELDS = [
  "id", "name", "mimeType", "size", "md5Checksum", "sha256Checksum", "createdTime",
  "modifiedTime", "ownedByMe", "version", "trashed", "capabilities(canTrash,canDelete)",
  "webViewLink", "thumbnailLink", "parents", "driveId", "shared",
].join(",");
const MINIMUM_AUTO_SELECT_BYTES = 1;
const MAX_MUTATION_ITEMS = 20;
const PROJECT_MARKERS = new Set([
  ".git", ".svn", ".hg", ".idea", ".vscode", "pyproject.toml", "package.json",
  "cargo.toml", "go.mod", "composer.json", "gemfile", "pom.xml", "build.gradle",
  "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
]);
const PROJECT_SUFFIXES = [".sln", ".csproj", ".fsproj", ".vbproj", ".vcxproj", ".xcodeproj"];
const PACKAGE_DIRECTORIES = new Set([
  ".venv", "venv", "env", "node_modules", "site-packages", "__pycache__", "vendor",
]);
const SYSTEM_METADATA_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const BACKUP_SYNC_NAMES = new Set([
  "backup", "backups", "snapshot", "snapshots", "restore", "archives",
  "onedrive", "dropbox", "google drive", "icloud drive", "syncthing", "nextcloud",
]);
const APPLICATION_SUFFIXES = [
  ".exe", ".dll", ".sys", ".msi", ".msp", ".appx", ".msix", ".cab", ".lnk", ".url",
];

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
    // Re-encrypt and renew the opaque HttpOnly session on every authenticated request.
    setCookie: cookie(
      SESSION_COOKIE,
      await encrypt(refreshed, env.SESSION_SECRET),
      request,
      SESSION_MAX_AGE_SECONDS,
    ),
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

function isProjectMarkerName(name: string): boolean {
  const folded = name.toLocaleLowerCase("en-US");
  return PROJECT_MARKERS.has(folded) || PROJECT_SUFFIXES.some((suffix) => folded.endsWith(suffix));
}

function driveProjectProtectedIds(files: DriveFile[]): Set<string> {
  const knownIds = new Set(files.map((file) => file.id));
  const children = new Map<string, Set<string>>();
  const roots = new Set<string>();
  const protectedIds = new Set<string>();
  for (const file of files) {
    const parents = file.parents ?? [];
    for (const parent of parents) {
      const bucket = children.get(parent) ?? new Set<string>();
      bucket.add(file.id);
      children.set(parent, bucket);
    }
    const folder = file.mimeType === "application/vnd.google-apps.folder";
    const folded = file.name.toLocaleLowerCase("en-US");
    if (isProjectMarkerName(file.name)) {
      protectedIds.add(file.id);
      for (const parent of parents) if (knownIds.has(parent)) roots.add(parent);
    }
    if (folder && PACKAGE_DIRECTORIES.has(folded)) {
      protectedIds.add(file.id);
      roots.add(file.id);
      for (const parent of parents) if (knownIds.has(parent)) roots.add(parent);
    }
  }
  const queue = [...roots];
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    protectedIds.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return protectedIds;
}

function drivePath(file: DriveFile, filesById: Map<string, DriveFile>): string {
  const segments = [file.name];
  const visited = new Set<string>([file.id]);
  let parentId = [...(file.parents ?? [])].sort()[0];
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = filesById.get(parentId);
    if (!parent) break;
    segments.unshift(parent.name);
    parentId = [...(parent.parents ?? [])].sort()[0];
  }
  segments.unshift("我的 Google Drive");
  return segments.join(" / ");
}

interface FolderTreeEntry {
  relativePath: string;
  size: number;
  checksum: string;
}

interface FolderManifest {
  checksum: string;
  entries: FolderTreeEntry[];
  ignoredMetadataCount: number;
  actualCount: number;
  actualBytes: number;
  latestModifiedTime: string;
}

async function sha256Text(value: string): Promise<string> {
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value))),
  );
}

async function folderManifests(
  files: DriveFile[],
  projectProtected: Set<string>,
  ignoreSystemMetadata: boolean,
): Promise<Map<string, FolderManifest>> {
  const byId = new Map(files.map((file) => [file.id, file]));
  const children = new Map<string, DriveFile[]>();
  for (const file of files) {
    for (const parent of file.parents ?? []) {
      const bucket = children.get(parent) ?? [];
      bucket.push(file);
      children.set(parent, bucket);
    }
  }
  const memo = new Map<string, Promise<FolderManifest | null>>();

  function visit(folderId: string, visiting: Set<string>): Promise<FolderManifest | null> {
    if (visiting.has(folderId)) return Promise.resolve(null);
    const cached = memo.get(folderId);
    if (cached) return cached;
    const pending = (async () => {
      const folder = byId.get(folderId);
      const folded = folder?.name.toLocaleLowerCase("en-US") ?? "";
      if (!folder || visiting.has(folderId) || projectProtected.has(folderId) ||
        folder.mimeType !== "application/vnd.google-apps.folder" || !folder.ownedByMe ||
        Boolean(folder.driveId) || !folder.capabilities?.canTrash ||
        PACKAGE_DIRECTORIES.has(folded) || BACKUP_SYNC_NAMES.has(folded)) return null;
      const nextVisiting = new Set(visiting).add(folderId);
      const entries: FolderTreeEntry[] = [];
      let ignoredMetadataCount = 0;
      let actualCount = 0;
      let actualBytes = 0;
      let latestModifiedTime = folder.modifiedTime ?? "";
      const descendants = [...(children.get(folderId) ?? [])]
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const child of descendants) {
        const childName = child.name.toLocaleLowerCase("en-US");
        if (child.mimeType === "application/vnd.google-apps.folder") {
          const nested = await visit(child.id, nextVisiting);
          if (!nested) return null;
          entries.push(...nested.entries.map((entry) => ({
            ...entry,
            relativePath: `${child.name}/${entry.relativePath}`,
          })));
          ignoredMetadataCount += nested.ignoredMetadataCount;
          actualCount += nested.actualCount;
          actualBytes += nested.actualBytes;
          latestModifiedTime = latestModifiedTime > nested.latestModifiedTime
            ? latestModifiedTime : nested.latestModifiedTime;
          continue;
        }
        const digest = checksum(child);
        const size = Number(child.size ?? 0);
        if (projectProtected.has(child.id) || !child.ownedByMe || Boolean(child.driveId) ||
          child.mimeType === "application/vnd.google-apps.shortcut" ||
          child.mimeType.startsWith("application/vnd.google-apps.") ||
          !digest || !child.size || size <= 0 || isProjectMarkerName(child.name) ||
          APPLICATION_SUFFIXES.some((suffix) => childName.endsWith(suffix))) return null;
        actualCount += 1;
        actualBytes += size;
        latestModifiedTime = latestModifiedTime > (child.modifiedTime ?? "")
          ? latestModifiedTime : (child.modifiedTime ?? "");
        if (ignoreSystemMetadata && SYSTEM_METADATA_NAMES.has(childName)) {
          ignoredMetadataCount += 1;
          continue;
        }
        entries.push({ relativePath: child.name, size, checksum: digest });
      }
      if (!entries.length) return null;
      entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
      const signature = entries
        .map((entry) => `${entry.relativePath}\0${entry.size}\0${entry.checksum}`)
        .join("\n");
      return {
        checksum: `folder-sha256:${await sha256Text(signature)}`,
        entries,
        ignoredMetadataCount,
        actualCount,
        actualBytes,
        latestModifiedTime,
      };
    })();
    memo.set(folderId, pending);
    return pending;
  }

  const output = new Map<string, FolderManifest>();
  await Promise.all(files
    .filter((file) => file.mimeType === "application/vnd.google-apps.folder")
    .map(async (folder) => {
      const manifest = await visit(folder.id, new Set());
      if (manifest) output.set(folder.id, manifest);
    }));
  return output;
}

function hasAncestor(
  file: DriveFile,
  ancestorIds: Set<string>,
  filesById: Map<string, DriveFile>,
): boolean {
  const pending = [...(file.parents ?? [])];
  const visited = new Set<string>();
  while (pending.length) {
    const parent = pending.pop() as string;
    if (ancestorIds.has(parent)) return true;
    if (visited.has(parent)) continue;
    visited.add(parent);
    pending.push(...(filesById.get(parent)?.parents ?? []));
  }
  return false;
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

async function listDrive(session: OAuthSession): Promise<{
  files: DriveFile[];
  listed: DriveFile[];
  paths: Map<string, string>;
  examined: number;
  skipped: number;
  projectProtected: number;
  protectedIds: Set<string>;
}> {
  const listed: DriveFile[] = [];
  let examined = 0;
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
      listed.push(file);
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  const protectedIds = driveProjectProtectedIds(listed);
  const filesById = new Map(listed.map((file) => [file.id, file]));
  const paths = new Map(listed.map((file) => [file.id, drivePath(file, filesById)]));
  let skipped = 0;
  const files = listed.filter((file) => {
    const unsupported = protectedIds.has(file.id) || unsupportedType(file) || !file.ownedByMe ||
      !file.size || Number(file.size) === 0 || !checksum(file) ||
      (!file.capabilities?.canTrash && !file.capabilities?.canDelete);
    if (unsupported) skipped += 1;
    return !unsupported;
  });
  return {
    files,
    listed,
    paths,
    examined,
    skipped,
    projectProtected: protectedIds.size,
    protectedIds,
  };
}

async function scan(request: Request, env: Required<GoogleDriveEnv>): Promise<Response> {
  requireSameOrigin(request);
  const { session, setCookie } = await authorizedSession(request, env);
  const requestBody = await request.json().catch(() => ({})) as {
    ignoreSystemMetadata?: boolean;
    protectedProfile?: "project" | "media" | "strict";
  };
  const ignoreSystemMetadata = requestBody.ignoreSystemMetadata === true;
  const protectedProfile = ["project", "media", "strict"].includes(requestBody.protectedProfile ?? "")
    ? requestBody.protectedProfile as "project" | "media" | "strict"
    : "project";
  const [drive, aboutResponse] = await Promise.all([
    listDrive(session),
    googleFetch(session, "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota"),
  ]);
  const { files, listed, paths, examined, skipped, projectProtected, protectedIds } = drive;
  const about = aboutResponse.ok ? await aboutResponse.json() as {
    storageQuota?: { limit?: string; usage?: string };
    user?: { displayName?: string; emailAddress?: string; photoLink?: string };
  } : {};
  const filesById = new Map(listed.map((file) => [file.id, file]));
  const fileBuckets = new Map<string, DriveFile[]>();
  for (const file of files) {
    const fingerprint = `${file.size}:${checksum(file)}`;
    const bucket = fileBuckets.get(fingerprint) ?? [];
    bucket.push(file);
    fileBuckets.set(fingerprint, bucket);
  }
  const manifests = await folderManifests(listed, protectedIds, ignoreSystemMetadata);
  const folderBuckets = new Map<string, DriveFile[]>();
  for (const [folderId, manifest] of manifests) {
    const folder = filesById.get(folderId);
    if (!folder) continue;
    const bucket = folderBuckets.get(manifest.checksum) ?? [];
    bucket.push(folder);
    folderBuckets.set(manifest.checksum, bucket);
  }
  const expiresAt = Date.now() + 30 * 60_000;
  const folderCandidates = [...folderBuckets.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([fingerprint, records]) => ({
      fingerprint,
      records: [...records].sort(compareRank),
    }))
    .sort((left, right) => {
      const leftDepth = Math.min(...left.records.map((record) => (paths.get(record.id) ?? "").split(" / ").length));
      const rightDepth = Math.min(...right.records.map((record) => (paths.get(record.id) ?? "").split(" / ").length));
      return leftDepth - rightDepth;
    });
  const coveredFolderIds = new Set<string>();
  const selectedFolderCandidates = folderCandidates.filter((group) => {
    if (group.records.some((record) => hasAncestor(record, coveredFolderIds, filesById))) return false;
    for (const record of group.records) coveredFolderIds.add(record.id);
    return true;
  });
  const selectedFileBuckets = [...fileBuckets.entries()]
    .filter(([, records]) => records.length > 1)
    .filter(([, records]) => !records.some((record) =>
      hasAncestor(record, coveredFolderIds, filesById)));

  const fileGroups = await Promise.all(selectedFileBuckets.map(async ([fingerprint, input]) => {
    const records = [...input].sort(compareRank);
    const keeper = records[0];
    const keeperDigest = checksum(keeper) ?? "";
    const output = await Promise.all(records.map(async (file) => ({
      id: file.id,
      name: file.name,
      size: Number(file.size),
      checksum: checksum(file),
      version: file.version ?? "",
      mimeType: file.mimeType,
      itemKind: "file" as const,
      entryCount: 1,
      ignoredMetadataCount: 0,
      systemMetadataIgnored: false,
      createdTime: file.createdTime ?? null,
      modifiedTime: file.modifiedTime ?? null,
      webViewLink: file.webViewLink ?? null,
      thumbnailLink: file.thumbnailLink ?? null,
      path: paths.get(file.id) ?? file.name,
      canTrash: Boolean(file.capabilities?.canTrash),
      canDelete: Boolean(file.capabilities?.canDelete),
      autoSelectable: protectedProfile !== "strict" && Boolean(file.capabilities?.canTrash) && Number(file.size) >= MINIMUM_AUTO_SELECT_BYTES,
      keeper: file.id === keeper.id,
      proof: await proof({
        id: file.id,
        version: file.version ?? "",
        checksum: checksum(file) ?? "",
        size: file.size ?? "0",
        modifiedTime: file.modifiedTime ?? "",
        mimeType: file.mimeType,
        parents: [...(file.parents ?? [])].sort(),
        path: paths.get(file.id) ?? file.name,
        keeperId: keeper.id,
        keeperVersion: keeper.version ?? "",
        keeperChecksum: keeperDigest,
        keeperModifiedTime: keeper.modifiedTime ?? "",
        keeperParents: [...(keeper.parents ?? [])].sort(),
        itemKind: "file",
        entryCount: 1,
        ignoredMetadataCount: 0,
        systemMetadataIgnored: false,
        keeperSize: keeper.size ?? "0",
        keeperEntryCount: 1,
        keeperIgnoredMetadataCount: 0,
        expiresAt,
      }, env.SESSION_SECRET),
    })));
    return {
      itemKind: "file" as const,
      fingerprint,
      reclaimableBytes: Number(keeper.size) * (records.length - 1),
      tree: [] as FolderTreeEntry[],
      records: output,
    };
  }));

  const folderGroups = await Promise.all(selectedFolderCandidates.map(async (group) => {
    const keeper = group.records[0];
    const keeperManifest = manifests.get(keeper.id) as FolderManifest;
    const output = await Promise.all(group.records.map(async (folder) => {
      const manifest = manifests.get(folder.id) as FolderManifest;
      return {
        id: folder.id,
        name: folder.name,
        size: manifest.actualBytes,
        checksum: manifest.checksum,
        version: folder.version ?? "",
        mimeType: folder.mimeType,
        itemKind: "folder" as const,
        entryCount: manifest.entries.length,
        ignoredMetadataCount: manifest.ignoredMetadataCount,
        systemMetadataIgnored: ignoreSystemMetadata,
        createdTime: folder.createdTime ?? null,
        modifiedTime: manifest.latestModifiedTime || null,
        webViewLink: folder.webViewLink ?? null,
        thumbnailLink: null,
        path: paths.get(folder.id) ?? folder.name,
        canTrash: Boolean(folder.capabilities?.canTrash),
        canDelete: false,
        autoSelectable: protectedProfile === "project" && Boolean(folder.capabilities?.canTrash) && manifest.actualBytes >= MINIMUM_AUTO_SELECT_BYTES,
        keeper: folder.id === keeper.id,
        proof: await proof({
          id: folder.id,
          version: folder.version ?? "",
          checksum: manifest.checksum,
          size: String(manifest.actualBytes),
          modifiedTime: manifest.latestModifiedTime,
          mimeType: folder.mimeType,
          parents: [...(folder.parents ?? [])].sort(),
          path: paths.get(folder.id) ?? folder.name,
          keeperId: keeper.id,
          keeperVersion: keeper.version ?? "",
          keeperChecksum: keeperManifest.checksum,
          keeperModifiedTime: keeperManifest.latestModifiedTime,
          keeperParents: [...(keeper.parents ?? [])].sort(),
          itemKind: "folder",
          entryCount: manifest.entries.length,
          ignoredMetadataCount: manifest.ignoredMetadataCount,
          systemMetadataIgnored: ignoreSystemMetadata,
          keeperSize: String(keeperManifest.actualBytes),
          keeperEntryCount: keeperManifest.entries.length,
          keeperIgnoredMetadataCount: keeperManifest.ignoredMetadataCount,
          expiresAt,
        }, env.SESSION_SECRET),
      };
    }));
    return {
      itemKind: "folder" as const,
      fingerprint: group.fingerprint,
      reclaimableBytes: output
        .filter((record) => !record.keeper)
        .reduce((total, record) => total + record.size, 0),
      tree: keeperManifest.entries,
      records: output,
    };
  }));
  const groups = [...folderGroups, ...fileGroups];
  groups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes);
  return json({
    examined,
    skipped,
    projectProtected,
    duplicateCopies: groups.reduce((total, group) => total + group.records.length - 1, 0),
    reclaimableBytes: groups.reduce((total, group) => total + group.reclaimableBytes, 0),
    groups,
    storageQuota: about.storageQuota ?? null,
    user: about.user ?? null,
    ignoreSystemMetadata,
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
  if (payload.itemKind !== "file") return "掃描證明的項目類型不一致";
  if (unsupportedType(file) || file.mimeType !== payload.mimeType) return "資料夾、捷徑或檔案類型變更，已跳過";
  if (file.version !== payload.version || file.modifiedTime !== payload.modifiedTime) return "檔案版本或修改時間已變更";
  if (JSON.stringify([...(file.parents ?? [])].sort()) !== JSON.stringify(payload.parents)) return "檔案已移至不同的 Google Drive 資料夾";
  if (file.size !== payload.size || checksum(file) !== payload.checksum) return "檔案大小或校驗碼已變更";
  if (mode === "trash" && !file.capabilities?.canTrash) return "沒有移至垃圾桶權限";
  if (mode === "permanent" && !file.capabilities?.canDelete) return "沒有永久刪除權限";
  return null;
}

function validateKeeper(file: DriveFile, payload: ProofPayload): string | null {
  if (file.id !== payload.keeperId || file.trashed || !file.ownedByMe) return "保留檔案已移動、刪除或不再由你擁有";
  if (unsupportedType(file)) return "保留項目不是可驗證的一般檔案";
  if (file.version !== payload.keeperVersion || file.modifiedTime !== payload.keeperModifiedTime) return "保留檔案版本已變更";
  if (JSON.stringify([...(file.parents ?? [])].sort()) !== JSON.stringify(payload.keeperParents)) return "保留檔案已移至不同的 Google Drive 資料夾";
  if (payload.itemKind !== "file") return "保留項目的掃描證明類型不一致";
  if (file.size !== payload.keeperSize || checksum(file) !== payload.keeperChecksum) return "保留檔案內容已變更";
  return null;
}

function validateFolderSnapshot(
  folder: DriveFile,
  payload: ProofPayload,
  manifest: FolderManifest | undefined,
  mode: OperationMode,
  keeper: boolean,
): string | null {
  if (payload.itemKind !== "folder") return "掃描證明的資料夾類型不一致";
  if (mode === "permanent") return "資料夾只能移至 Google Drive 垃圾桶，不能永久刪除";
  const expectedId = keeper ? payload.keeperId : payload.id;
  const expectedParents = keeper ? payload.keeperParents : payload.parents;
  const expectedVersion = keeper ? payload.keeperVersion : payload.version;
  const expectedLatest = keeper ? payload.keeperModifiedTime : payload.modifiedTime;
  const expectedChecksum = keeper ? payload.keeperChecksum : payload.checksum;
  const expectedSize = Number(keeper ? payload.keeperSize : payload.size);
  const expectedCount = keeper ? payload.keeperEntryCount : payload.entryCount;
  const expectedIgnored = keeper
    ? payload.keeperIgnoredMetadataCount : payload.ignoredMetadataCount;
  if (folder.id !== expectedId || folder.trashed || !folder.ownedByMe || folder.driveId) {
    return "資料夾已移動、刪除、位於共用雲端硬碟或不再由你擁有";
  }
  if (folder.mimeType !== "application/vnd.google-apps.folder") return "項目已不再是資料夾";
  if (folder.version !== expectedVersion) return "資料夾版本已變更";
  if (JSON.stringify([...(folder.parents ?? [])].sort()) !== JSON.stringify(expectedParents)) {
    return "資料夾已移至不同的 Google Drive 位置";
  }
  if (!manifest || manifest.checksum !== expectedChecksum ||
    manifest.actualBytes !== expectedSize || manifest.entries.length !== expectedCount ||
    manifest.ignoredMetadataCount !== expectedIgnored ||
    manifest.latestModifiedTime !== expectedLatest) {
    return "資料夾內容已變更，操作已取消";
  }
  if (!keeper && !folder.capabilities?.canTrash) return "沒有移至垃圾桶權限";
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
    path: payload.path,
    size: Number(payload.size),
    checksum: payload.checksum,
    operationMode: mode,
    itemKind: payload.itemKind,
    status,
    reason,
  };
}

async function mutate(request: Request, env: Required<GoogleDriveEnv>, mode: OperationMode): Promise<Response> {
  requireSameOrigin(request);
  const { session, setCookie } = await authorizedSession(request, env);
  const body = await request.json() as { items?: Array<{ id?: string; proof?: string }> };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_MUTATION_ITEMS) {
    return json({ error: `每批必須包含 1 至 ${MAX_MUTATION_ITEMS} 個檔案` }, 400);
  }
  const verified = await Promise.all(body.items.map(async (item) => {
    const payload = item.proof ? await verifyProof(item.proof, env.SESSION_SECRET) : null;
    return payload && payload.id === item.id && payload.id !== payload.keeperId ? payload : null;
  }));
  if (verified.some((item) => item === null)) return json({ error: "掃描證明無效或已過期，請重新掃描" }, 409);

  const folderPayloads = (verified as ProofPayload[])
    .filter((payload) => payload.itemKind === "folder");
  let currentDriveFiles: Map<string, DriveFile> | null = null;
  let currentFolderManifests: Map<string, FolderManifest> | null = null;
  if (folderPayloads.length) {
    const currentDrive = await listDrive(session);
    currentDriveFiles = new Map(currentDrive.listed.map((file) => [file.id, file]));
    currentFolderManifests = await folderManifests(
      currentDrive.listed,
      currentDrive.protectedIds,
      folderPayloads.some((payload) => payload.systemMetadataIgnored),
    );
  }

  const keeperCache = new Map<string, Promise<DriveFile>>();
  const keeperFor = (id: string) => {
    const cached = keeperCache.get(id);
    if (cached) return cached;
    const pending = getFile(session, id);
    keeperCache.set(id, pending);
    return pending;
  };
  const outcomes = await mapConcurrent(verified as ProofPayload[], 3, async (payload) => {
    let current: DriveFile | null = null;
    try {
      const [target, keeper] = await Promise.all([
        getFile(session, payload.id),
        keeperFor(payload.keeperId),
      ]);
      current = target;
      if (payload.itemKind === "folder") {
        const currentTarget = currentDriveFiles?.get(payload.id) ?? target;
        const currentKeeper = currentDriveFiles?.get(payload.keeperId) ?? keeper;
        const targetFailure = validateFolderSnapshot(
          currentTarget,
          payload,
          currentFolderManifests?.get(payload.id),
          mode,
          false,
        );
        if (targetFailure) return auditOutcome(payload, target, mode, "skipped", targetFailure);
        const keeperFailure = validateFolderSnapshot(
          currentKeeper,
          payload,
          currentFolderManifests?.get(payload.keeperId),
          mode,
          true,
        );
        if (keeperFailure) return auditOutcome(payload, target, mode, "skipped", keeperFailure);
      } else {
        const targetFailure = validateSnapshot(target, payload, mode);
        if (targetFailure) return auditOutcome(payload, target, mode, "skipped", targetFailure);
        const keeperFailure = validateKeeper(keeper, payload);
        if (keeperFailure) return auditOutcome(payload, target, mode, "skipped", keeperFailure);
      }

      const endpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(payload.id)}?supportsAllDrives=false`;
      const response = mode === "trash"
        ? await googleFetch(session, `${endpoint}&fields=id,trashed`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        })
        : await googleFetch(session, endpoint, { method: "DELETE" });
      if (!response.ok) return auditOutcome(payload, target, mode, "failed", `Google Drive API 回覆 ${response.status}`);
      if (mode === "trash") {
        const result = await response.json() as { id?: string; trashed?: boolean };
        if (result.id !== payload.id || result.trashed !== true) {
          return auditOutcome(payload, target, mode, "failed", "Google Drive 未確認檔案已進入垃圾桶");
        }
      }
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

async function restore(request: Request, env: Required<GoogleDriveEnv>): Promise<Response> {
  requireSameOrigin(request);
  const { session, setCookie } = await authorizedSession(request, env);
  const body = await request.json() as { items?: Array<{ id?: string; proof?: string }> };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_MUTATION_ITEMS) {
    return json({ error: `每批必須包含 1 至 ${MAX_MUTATION_ITEMS} 個項目` }, 400);
  }
  const verified = await Promise.all(body.items.map(async (item) => {
    const payload = item.proof ? await verifyProof(item.proof, env.SESSION_SECRET) : null;
    return payload && payload.id === item.id && payload.id !== payload.keeperId ? payload : null;
  }));
  if (verified.some((item) => item === null)) return json({ error: "復原證明無效或已過期，請至 Google Drive 垃圾桶手動復原" }, 409);

  const outcomes = await mapConcurrent(verified as ProofPayload[], 3, async (payload) => {
    let current: DriveFile | null = null;
    const outcome = (status: "restored" | "failed" | "skipped", reason: string) => ({
      timestamp: new Date().toISOString(),
      id: payload.id,
      name: current?.name ?? "",
      path: payload.path,
      size: Number(payload.size),
      checksum: payload.checksum,
      operationMode: "restore" as const,
      itemKind: payload.itemKind,
      status,
      reason,
    });
    try {
      current = await getFile(session, payload.id);
      if (!current.trashed) return outcome("skipped", "項目已不在 Google Drive 垃圾桶");
      if (!current.ownedByMe || current.driveId) return outcome("skipped", "只有本人擁有且非共用雲端硬碟的項目可以快速復原");
      if (payload.itemKind === "folder" && current.mimeType !== "application/vnd.google-apps.folder") return outcome("skipped", "項目類型已變更，請至 Google Drive 垃圾桶手動復原");
      if (payload.itemKind === "file" && unsupportedType(current)) return outcome("skipped", "項目類型已變更，請至 Google Drive 垃圾桶手動復原");
      const response = await googleFetch(
        session,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(payload.id)}?supportsAllDrives=false&fields=id,trashed`,
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ trashed: false }) },
      );
      if (!response.ok) return outcome("failed", `Google Drive API 回覆 ${response.status}`);
      const result = await response.json() as { id?: string; trashed?: boolean };
      if (result.id !== payload.id || result.trashed !== false) return outcome("failed", "Google Drive 未確認項目已復原");
      return outcome("restored", "已從 Google Drive 垃圾桶復原");
    } catch (error) {
      return outcome("failed", error instanceof Error ? error.message : "未知錯誤");
    }
  });
  return json({ operationMode: "restore", outcomes }, 200, setCookie ? { "set-cookie": setCookie } : undefined);
}

export async function handleGoogleDriveApi(request: Request, env: GoogleDriveEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const sessionPath = url.pathname === "/api/auth/session";
  if (!url.pathname.startsWith("/api/google/") && !sessionPath) return null;
  try {
    if ((url.pathname === "/api/google/status" || sessionPath) && request.method === "GET") {
      const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
      if (!configured) return json({ connected: false, configured: false });
      requireConfig(env);
      const session = await decrypt<OAuthSession>(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
      if (!session) return json({ connected: false, configured: true, user: null });
      const refreshed = await refreshSession(session, env);
      const accountResponse = await googleFetch(
        refreshed,
        "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)",
      );
      const account = accountResponse.ok
        ? await accountResponse.json() as { user?: DriveUser }
        : { user: undefined };
      const setCookie = cookie(
        SESSION_COOKIE,
        await encrypt(refreshed, env.SESSION_SECRET),
        request,
        SESSION_MAX_AGE_SECONDS,
      );
      return json(
        { connected: true, configured: true, user: account.user ?? null },
        200,
        { "set-cookie": setCookie },
      );
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
        scope: DRIVE_SCOPE,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "false",
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
      headers.append("set-cookie", cookie(SESSION_COOKIE, await encrypt(session, env.SESSION_SECRET), request, SESSION_MAX_AGE_SECONDS));
      headers.append("set-cookie", clearCookie(OAUTH_COOKIE, request));
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === "/api/google/disconnect" && request.method === "POST") {
      requireSameOrigin(request);
      const session = await decrypt<OAuthSession>(
        parseCookies(request)[SESSION_COOKIE],
        env.SESSION_SECRET,
      );
      const token = session?.refreshToken ?? session?.accessToken;
      if (token) {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
        }).catch(() => undefined);
      }
      return json(
        { connected: false },
        200,
        { "set-cookie": clearCookie(SESSION_COOKIE, request) },
      );
    }
    if (url.pathname === "/api/google/scan" && request.method === "POST") return scan(request, env);
    if (url.pathname === "/api/google/trash" && request.method === "POST") return mutate(request, env, "trash");
    if (url.pathname === "/api/google/restore" && request.method === "POST") return restore(request, env);
    if (url.pathname === "/api/google/delete" && request.method === "POST") return mutate(request, env, "permanent");
    return json({ error: "找不到 API 路徑" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器處理失敗";
    const status = message.includes("登入") ? 401 : message.includes("設定") ? 503 : message.includes("來源") ? 403 : 500;
    return json({ error: message }, status);
  }
}
