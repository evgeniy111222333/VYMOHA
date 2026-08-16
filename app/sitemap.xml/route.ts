import { guides } from "@/src/content/guides";
import {
  countPublicTenderSummaries,
  listAllTenderClasses,
  listDistinctBuyers,
  listPublicTenderSitemapEntries,
  listTenderDivisions,
} from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

const SHARD_SIZE = 40_000;
const LEGAL_UPDATED_AT = "2026-08-03";

const CONTENT_UPDATED_AT = (() => {
  const dates = guides.map((guide) => guide.updated).sort();
  return dates.length ? dates[dates.length - 1] : "2026-08-01";
})();

type SitemapUrl = { loc: string; lastmod?: string; changefreq?: string; priority?: number };

const STATIC_URLS: SitemapUrl[] = [
  { loc: SITE_ORIGIN, changefreq: "weekly", priority: 1 },
  { loc: `${SITE_ORIGIN}/analyze`, changefreq: "weekly", priority: 0.9 },
  { loc: `${SITE_ORIGIN}/guides`, changefreq: "weekly", priority: 0.8, lastmod: CONTENT_UPDATED_AT },
  ...guides.map((guide) => ({
    loc: `${SITE_ORIGIN}/guides/${guide.slug}`,
    changefreq: "monthly" as const,
    priority: 0.7,
    lastmod: guide.updated,
  })),
  { loc: `${SITE_ORIGIN}/tendery`, changefreq: "daily", priority: 0.6 },
  { loc: `${SITE_ORIGIN}/terminy`, changefreq: "monthly", priority: 0.5 },
  { loc: `${SITE_ORIGIN}/statystyka`, changefreq: "weekly", priority: 0.6 },
  { loc: `${SITE_ORIGIN}/pro-nas`, changefreq: "yearly", priority: 0.3 },
  { loc: `${SITE_ORIGIN}/privacy`, changefreq: "yearly", priority: 0.2, lastmod: LEGAL_UPDATED_AT },
  { loc: `${SITE_ORIGIN}/terms`, changefreq: "yearly", priority: 0.2, lastmod: LEGAL_UPDATED_AT },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validLastmod(value: string): string | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function isActiveStatus(status: string): boolean {
  return status.startsWith("active");
}

function renderUrlset(urls: SitemapUrl[]): string {
  const entries = urls.map((url) => {
    const lastmod = url.lastmod ? `\n    <lastmod>${escapeXml(url.lastmod)}</lastmod>` : "";
    const changefreq = url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : "";
    const priority = url.priority !== undefined ? `\n    <priority>${url.priority}</priority>` : "";
    return `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function renderSitemapIndex(locations: string[]): string {
  const entries = locations.map((loc) => `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shardParam = url.searchParams.get("shard");

  if (shardParam === null) {
    const total = await countPublicTenderSummaries();
    const shardCount = Math.ceil(total / SHARD_SIZE);
    const locations = [
      `${SITE_ORIGIN}/sitemap.xml?shard=static`,
      `${SITE_ORIGIN}/sitemap.xml?shard=catalog`,
      ...Array.from({ length: shardCount }, (_, index) => `${SITE_ORIGIN}/sitemap.xml?shard=${index}`),
    ];
    return xmlResponse(renderSitemapIndex(locations));
  }

  if (shardParam === "static") {
    return xmlResponse(renderUrlset(STATIC_URLS));
  }

  if (shardParam === "catalog") {
    const [divisions, classes, buyers] = await Promise.all([listTenderDivisions(500), listAllTenderClasses(3, 2000), listDistinctBuyers(2000)]);
    const urls: SitemapUrl[] = [
      ...divisions.map((division) => ({
        loc: `${SITE_ORIGIN}/tendery/${division.division}`,
        changefreq: "weekly" as const,
        priority: 0.5,
      })),
      ...classes.map((entry) => ({
        loc: `${SITE_ORIGIN}/tendery/${entry.division}/${entry.cls}`,
        changefreq: "weekly" as const,
        priority: 0.45,
      })),
      ...buyers.map((buyer) => ({
        loc: `${SITE_ORIGIN}/zamovnyky/${buyer.edrpou}`,
        changefreq: "weekly" as const,
        priority: 0.4,
      })),
    ];
    return xmlResponse(renderUrlset(urls));
  }

  const shard = Number(shardParam);
  if (!Number.isInteger(shard) || shard < 0) {
    return new Response("Invalid shard", { status: 400 });
  }

  const entries = await listPublicTenderSitemapEntries(SHARD_SIZE, shard * SHARD_SIZE);
  const urls: SitemapUrl[] = entries.map((entry) => {
    const active = isActiveStatus(entry.status);
    return {
      loc: `${SITE_ORIGIN}/analyze/${entry.tenderExternalId}`,
      lastmod: validLastmod(entry.dateModified ?? entry.updatedAt),
      changefreq: active ? "weekly" : "monthly",
      priority: active ? 0.6 : 0.3,
    };
  });
  return xmlResponse(renderUrlset(urls));
}
