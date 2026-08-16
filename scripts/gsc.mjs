import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const SCOPES = "https://www.googleapis.com/auth/webmasters";
const CLOUD_SCOPES = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const INSPECT_URI = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

const keyPath = process.argv[2] ?? "./gsc-key.json";
const key = JSON.parse(readFileSync(new URL(`../${keyPath}`, import.meta.url), "utf8"));

const encoder = (input) => Buffer.from(JSON.stringify(input)).toString("base64url");
const sign = (data) => crypto.sign("RSA-SHA256", Buffer.from(data), key.private_key);

const accessToken = await getAccessToken(key);

async function getAccessToken(key, scope = SCOPES) {
  const jwt = `${encoder({ alg: "RS256", typ: "JWT" })}.${encoder({
    iss: key.client_email,
    scope,
    aud: key.token_uri,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const assertion = `${jwt}.${sign(jwt).toString("base64url")}`;
  const tokenResponse = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokenResponse.ok) throw new Error(`token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  return (await tokenResponse.json()).access_token;
}

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
};

const [command, ...args] = process.argv.slice(3);

if (command === "enable-api") {
  const [serviceId] = args;
  const cloudToken = await getAccessToken(key, CLOUD_SCOPES);
  const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${key.project_id}/services/${serviceId}:enable`, {
    method: "POST",
    headers: { authorization: `Bearer ${cloudToken}` },
  });
  const body = await response.json().catch(() => null);
  console.log(`${response.status} ${body?.name ?? JSON.stringify(body)} state=${body?.state ?? "?"}`);
  if (!response.ok) process.exitCode = 1;
} else if (command === "list-sites") {
  const { siteEntry } = await api(`${GSC_BASE}/sites`);
  for (const site of siteEntry ?? []) console.log(`${site.permissionLevel ?? "?"}\t${site.siteUrl}`);
} else if (command === "submit-sitemap") {
  const [site, path] = args;
  const response = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(path)}`, {
    method: "PUT", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
  });
  console.log(`PUT sitemap ${path}: ${response.status}`);
  if (!response.ok) console.log(await response.text());
} else if (command === "sitemaps") {
  const [site] = args;
  const { sitemap } = await api(`${GSC_BASE}/sites/${encodeURIComponent(site)}/sitemaps`);
  for (const entry of sitemap ?? []) console.log(`${entry.path}\t${entry.errors ?? 0} errors\t${entry.isPending ? "pending" : ""}`);
} else if (command === "inspect") {
  const [site, url] = args;
  const { inspectionResult } = await api(INSPECT_URI, {
    method: "POST",
    body: JSON.stringify({ inspectionUrl: url, siteUrl: site }),
  });
  console.log(`URL: ${url}`);
  console.log(`verdict: ${inspectionResult.indexStatusResult?.verdict ?? "?"}`);
  console.log(`coverage: ${inspectionResult.indexStatusResult?.coverageState ?? "?"}`);
  console.log(`robotsTxt: ${inspectionResult.indexStatusResult?.robotsTxtState ?? "?"}`);
  console.log(`crawledAs: ${inspectionResult.indexStatusResult?.crawledAs ?? "?"}`);
  console.log(`sitemap: ${inspectionResult.indexStatusResult?.lastCrawled ?? "?"}`);
} else if (command === "performance") {
  const [site, days = "30"] = args;
  const end = new Date();
  const start = new Date(Date.now() - Number(days) * 86400000);
  const { rows = [] } = await api(`${GSC_BASE}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query", "page"],
      rowLimit: 20,
    }),
  });
  console.log(`Покази ${rows.reduce((s, r) => s + (r.impressions ?? 0), 0)} · Кліки ${rows.reduce((s, r) => s + (r.clicks ?? 0), 0)} · CTR ${((rows.reduce((s, r) => s + (r.clicks ?? 0), 0) / Math.max(1, rows.reduce((s, r) => s + (r.impressions ?? 0), 0))) * 100).toFixed(2)}% · Avg pos ${(rows.reduce((s, r) => s + (r.position ?? 0) * (r.impressions ?? 0), 0) / Math.max(1, rows.reduce((s, r) => s + (r.impressions ?? 0), 0))).toFixed(1)}`);
  for (const row of rows) console.log(`${row.clicks ?? 0}\t${row.impressions ?? 0}\t${(row.position ?? 0).toFixed(1)}\t${row.keys.join(" | ")}`);
} else {
  console.log("usage: node scripts/gsc.mjs <key> list-sites|submit-sitemap <site> <path>|sitemaps <site>|inspect <site> <url>|performance <site> [days]");
}