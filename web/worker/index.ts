/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleGoogleDriveApi, type GoogleDriveEnv } from "./google-drive";

interface Env extends GoogleDriveEnv {
  ASSETS: Fetcher;
  IMAGES: ImagesBinding;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const legacyHost = url.hostname === "dupesweep.app" || url.hostname === "www.dupesweep.app" || url.hostname.endsWith(".chatgpt.site");
    const canonicalWww = url.hostname === "www.dupespace.app";
    if (legacyHost || canonicalWww) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return Response.json(
          { error: "此網域已停用寫入操作，請重新開啟 https://dupespace.app 後再試。" },
          { status: 409, headers: { "cache-control": "no-store" } },
        );
      }
      return Response.redirect(`https://dupespace.app${url.pathname}${url.search}`, 301);
    }

    const googleResponse = await handleGoogleDriveApi(request, env);
    if (googleResponse) return withSecurityHeaders(googleResponse);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return withSecurityHeaders(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const outputFormat = format === "image/png" || format === "image/gif" ||
            format === "image/webp" || format === "image/avif" ? format : "image/jpeg";
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: outputFormat, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.googletagservices.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://api.github.com https://pagead2.googlesyndication.com; frame-src https://accounts.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; upgrade-insecure-requests",
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default worker;
