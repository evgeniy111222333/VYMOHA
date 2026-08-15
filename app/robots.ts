import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api"] }],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
