import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const SITE = "sc-domain:vymoha.com";
const ORIGIN = "https://vymoha.com";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const CF_ACCOUNT = "111db7aacae65b6828b4d6c332e1f7c3";

const gscKey = JSON.parse(readFileSync(new URL("../gsc-key.json", import.meta.url), "utf8"));
const cfToken = process.env.CLOUDFLARE_ANALYTICS_TOKEN
  ?? readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^CLOUDFLARE_ANALYTICS_TOKEN=(.+)$/m)?.[1]?.trim();

const encoder = (input) => Buffer.from(JSON.stringify(input)).toString("base64url");
const sign = (data) => crypto.sign("RSA-SHA256", Buffer.from(data), gscKey.private_key);

async function gscAccessToken() {
  const jwt = `${encoder({ alg: "RS256", typ: "JWT" })}.${encoder({
    iss: gscKey.client_email,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: gscKey.token_uri,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const assertion = `${jwt}.${sign(jwt).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  return (await res.json()).access_token;
}

async function cfQuery(query) {
  const res = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: { authorization: `Bearer ${cfToken}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  return body.data ?? {};
}

async function fetchSitemapCounts() {
  const counts = { tenders: 0, catalog: 0, staticUrls: 0, health: [] };
  const shards = ["static", "catalog", "0"];
  for (const shard of shards) {
    const res = await fetch(`${ORIGIN}/sitemap.xml?shard=${shard}`);
    if (!res.ok) counts.health.push(`sitemap shard "${shard}" HTTP ${res.status}`);
    const xml = await res.text();
    if (!res.ok) continue;
    if (shard === "0") counts.tenders = (xml.match(/<loc>/g) ?? []).length;
    if (shard === "catalog") counts.catalog = (xml.match(/<loc>/g) ?? []).length;
    if (shard === "static") counts.staticUrls = (xml.match(/<loc>/g) ?? []).length;
  }
  return counts;
}

const token = await gscAccessToken();
const gsc = async (url) => {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  return res.status === 204 ? null : res.json().catch(() => null);
};

const { siteEntry } = await gsc(`${GSC_BASE}/sites`);
const { sitemap } = await gsc(`${GSC_BASE}/sites/${encodeURIComponent(SITE)}/sitemaps`);

const end = new Date();
const start = new Date(Date.now() - 30 * 86400000);
let impressions = 0, clicks = 0;
try {
  const res = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), rowLimit: 500 }),
  });
  const body = await res.json();
  for (const r of body.rows ?? []) { impressions += r.impressions ?? 0; clicks += r.clicks ?? 0; }
} catch { /* no search data yet */ }

const counts = await fetchSitemapCounts();

console.log("=== SEO REPORT", new Date().toISOString().slice(0, 10), "===\n");

console.log("[Search Console]");
console.log(`  Property: ${siteEntry?.map((s) => s.siteUrl).join(", ") ?? "n/a"}`);
console.log(`  Sitemap status: ${sitemap?.[0]?.isPending ? "pending" : "active"}${sitemap?.[0]?.errors ? `, ${sitemap[0].errors} errors` : ""}`);
console.log(`  Impressions (30d): ${impressions}`);
console.log(`  Clicks (30d): ${clicks}`);
console.log(`  CTR: ${impressions ? ((clicks / impressions) * 100).toFixed(2) + "%" : "n/a"}`);

console.log("\n[Sitemap URLs]");
console.log(`  Static pages: ${counts.staticUrls}`);
console.log(`  Tender pages: ${counts.tenders}`);
console.log(`  Catalog pages: ${counts.catalog}`);
console.log(`  Total: ${counts.staticUrls + counts.tenders + counts.catalog}`);
if (counts.health.length) {
  console.log("  ⚠️ Health issues:");
  for (const issue of counts.health) console.log(`    - ${issue}`);
} else {
  console.log("  Health: OK (all shards 200)");
}

if (cfToken) {
  const days = 7;
  const cStart = new Date(Date.now() - days * 86400000).toISOString();
  const cEnd = new Date().toISOString();
  try {
    const { viewer } = await cfQuery(`{
      viewer { accounts(filter: { accountTag: "${CF_ACCOUNT}" }) {
        rumPageloadEventsAdaptiveGroups(filter: { datetime_geq: "${cStart}", datetime_leq: "${cEnd}" }, limit: 10000) {
          count sum { visits } dimensions { requestPath }
        }
        rumWebVitalsEventsAdaptiveGroups(filter: { datetime_geq: "${cStart}", datetime_leq: "${cEnd}" }, limit: 10000) {
          avg { largestContentfulPaint interactionToNextPaint cumulativeLayoutShift timeToFirstByte }
        }
      } }
    }`);
    const acc = viewer?.accounts?.[0];
    const pages = acc?.rumPageloadEventsAdaptiveGroups ?? [];
    const loads = pages.reduce((s, r) => s + (r.count ?? 0), 0);
    const visits = pages.reduce((s, r) => s + (r.sum?.visits ?? 0), 0);
    const cwv = acc?.rumWebVitalsEventsAdaptiveGroups?.[0];
    const ms = (v) => (v == null || v < 0 ? "n/a" : `${(v / 1000).toFixed(0)}ms`);
    console.log("\n[Cloudflare Web Analytics]");
    console.log(`  Page loads (${days}d): ${loads} · visits: ${visits}`);
    const top = [...pages].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 5);
    for (const p of top) console.log(`    ${p.count}  ${p.dimensions.requestPath}`);
    console.log(`  CWV: LCP ${ms(cwv?.avg?.largestContentfulPaint)} · INP ${ms(cwv?.avg?.interactionToNextPaint)} · CLS ${cwv?.avg?.cumulativeLayoutShift} · TTFB ${ms(cwv?.avg?.timeToFirstByte)}`);
  } catch (e) {
    console.log("\n[Cloudflare Web Analytics] unavailable:", e.message);
  }
} else {
  console.log("\n[Cloudflare Web Analytics] CLOUDFLARE_ANALYTICS_TOKEN not set");
}
