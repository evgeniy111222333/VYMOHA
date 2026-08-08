import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: ["/", "/analyze", "/guides/"], disallow: ["/dashboard/", "/api/"] }], sitemap: "https://vymoha.vymoha-platform.workers.dev/sitemap.xml" }; }
