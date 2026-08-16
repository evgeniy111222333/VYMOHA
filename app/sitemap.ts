import type { MetadataRoute } from "next";
import { guides } from "@/src/content/guides";
import { SITE_ORIGIN } from "@/src/lib/seo";

const LEGAL_UPDATED_AT = new Date("2026-08-03T00:00:00.000Z");

const CONTENT_UPDATED_AT = (() => {
  const dates = guides.map((guide) => guide.updated).sort();
  return dates.length ? dates[dates.length - 1] : "2026-08-01";
})();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN, priority: 1, changeFrequency: "weekly" },
    { url: `${SITE_ORIGIN}/analyze`, priority: 0.9, changeFrequency: "weekly" },
    { url: `${SITE_ORIGIN}/guides`, priority: 0.8, changeFrequency: "weekly", lastModified: CONTENT_UPDATED_AT },
    ...guides.map((guide) => ({
      url: `${SITE_ORIGIN}/guides/${guide.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: guide.updated,
    })),
    { url: `${SITE_ORIGIN}/privacy`, priority: 0.2, changeFrequency: "yearly", lastModified: LEGAL_UPDATED_AT },
    { url: `${SITE_ORIGIN}/terms`, priority: 0.2, changeFrequency: "yearly", lastModified: LEGAL_UPDATED_AT },
  ];
}