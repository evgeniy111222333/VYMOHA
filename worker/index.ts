/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runMonitoringCycle } from "@/src/services/monitoring/run-cycle";
import { backfillTenderPages, refreshRecentTenderPages } from "@/src/services/seo/tender-backfill";
import { recordBackfillRun, runSeoMonitoring } from "@/src/services/seo/health";
import { captureError, runErrorMonitoring } from "@/src/services/observability/errors";
import { canonicalHostRedirectUrl } from "@/src/lib/canonical-host";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL_STANDARD?: string;
  GEMINI_MODEL_EXPERT?: string;
  // Temporary aliases while existing production secrets are migrated.
  OPENAI_API_KEY?: string;
  OPENAI_MODEL_STANDARD?: string;
  OPENAI_MODEL_EXPERT?: string;
  MONOBANK_JAR_ID?: string;
  MONOBANK_WEBHOOK_SECRET?: string;
  APP_BASE_URL?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_FROM?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.protocol === "http:" && url.hostname !== "localhost" && !url.hostname.startsWith("127.")) {
      url.protocol = "https:";
      return Response.redirect(url.href, 301);
    }

    const canonicalRedirect = canonicalHostRedirectUrl(url);
    if (canonicalRedirect) {
      return Response.redirect(canonicalRedirect, 301);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    let response: Response;
    try {
      response = await handler.fetch(request, env, ctx);
    } catch (error) {
      ctx.waitUntil(captureError({ source: "server", route: url.pathname, error, context: { method: request.method } }).catch(() => {}));
      response = new Response("Внутрішня помилка сервера. Спробуйте ще раз.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return withSecurityHeaders(response, request);
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runMonitoringCycle({ notificationApiKey: env.RESEND_API_KEY, notificationFrom: env.NOTIFICATION_FROM }).catch((error) => {
      void captureError({ source: "cron", route: "job:monitoring", error });
    }));
    ctx.waitUntil(runSeoBackfillAndMonitor());
  },
};

function withSecurityHeaders(response: Response, request: Request): Response {
  const secured = new Response(response.body, response);
  const headers = secured.headers;
  const url = new URL(request.url);
  if (url.hostname !== "localhost" && !url.hostname.startsWith("127.")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (isNonIndexablePath(url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://public-api.prozorro.gov.ua https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "));
  return secured;
}

function isNonIndexablePath(pathname: string): boolean {
  return ["/api", "/auth", "/dashboard"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * SEO-backfill виконується послідовно і в межах ліміту підзапитів Worker.
 * Кожен фетч тендера живить і SEO-сторінку, і ринковий індекс (для завершених),
 * тому окремий ринковий backfill більше не потрібен.
 */
async function runSeoBackfillAndMonitor(): Promise<void> {
  const refresh = await refreshRecentTenderPages(15).catch((error) => {
    void captureError({ source: "cron", route: "job:refresh", error });
    return { processed: 0, upserted: 0, skipped: 0, failed: 0, cursor: null, finished: false };
  });
  await recordBackfillRun("refresh", refresh).catch(() => {});
  const history = await backfillTenderPages(25).catch((error) => {
    void captureError({ source: "cron", route: "job:history", error });
    return { processed: 0, upserted: 0, skipped: 0, failed: 0, cursor: null, finished: false };
  });
  await recordBackfillRun("history", history).catch(() => {});
  await runSeoMonitoring().catch(() => ({ issues: 0, alertsSent: 0 }));
  await runErrorMonitoring().catch(() => ({ issues: 0, alertsSent: 0 }));
}

export default worker;
