import { readFileSync } from "node:fs";

const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const ACCOUNT_TAG = "111db7aacae65b6828b4d6c332e1f7c3";

const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN
  ?? (() => {
    try {
      const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
      const match = raw.match(/^CLOUDFLARE_ANALYTICS_TOKEN=(.+)$/m);
      return match?.[1]?.trim();
    } catch {
      return undefined;
    }
  })();

let rest = process.argv.slice(2);
if (!token) {
  token = rest[0];
  rest = rest.slice(1);
}

if (!token) {
  console.log("usage: node scripts/cf-analytics.mjs <traffic|pages|referrers|countries|webvitals> [days]");
  console.log("  or set CLOUDFLARE_ANALYTICS_TOKEN env var, or pass <token> as first arg");
  process.exit(1);
}

async function gql(query, variables = {}) {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors ?? body, null, 2));
  return body.data;
}

const [command, ...args] = rest;
const days = Number(args[0] ?? 7);
const end = new Date();
const start = new Date(Date.now() - days * 86400000);
const fmt = (d) => d.toISOString();

const pageload = (dimension) => gql(`{
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(filter: { datetime_geq: $start, datetime_leq: $end }, limit: 10000) {
        count
        sum { visits }
        dimensions { ${dimension} }
      }
    }
  }
}`, { account: ACCOUNT_TAG, start: fmt(start), end: fmt(end) });

if (command === "traffic") {
  const { viewer } = await pageload("datetimeHour");
  const rows = viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  const views = rows.reduce((s, r) => s + (r.count ?? 0), 0);
  const visits = rows.reduce((s, r) => s + (r.sum?.visits ?? 0), 0);
  console.log(`${days}d: ${views} page loads · ${visits} visits`);
  for (const r of rows.slice().reverse()) {
    console.log(`${r.dimensions.datetimeHour}\tloads=${r.count ?? 0}\tvisits=${r.sum?.visits ?? 0}`);
  }
} else if (command === "pages") {
  const { viewer } = await pageload("requestPath");
  const rows = viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  for (const r of rows) console.log(`${r.count ?? 0}\t${r.dimensions.requestPath}`);
} else if (command === "referrers") {
  const { viewer } = await pageload("refererHost");
  const rows = viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  for (const r of rows) console.log(`${r.count ?? 0}\t${r.dimensions.refererHost || "(direct)"}`);
} else if (command === "countries") {
  const { viewer } = await pageload("countryName");
  const rows = viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  for (const r of rows) console.log(`${r.count ?? 0}\t${r.dimensions.countryName || "(unknown)"}`);
} else if (command === "webvitals") {
  const { viewer } = await gql(`{
    viewer {
      accounts(filter: { accountTag: $account }) {
        rumWebVitalsEventsAdaptiveGroups(filter: { datetime_geq: $start, datetime_leq: $end }, limit: 10000) {
          count
          avg { largestContentfulPaint interactionToNextPaint cumulativeLayoutShift timeToFirstByte firstContentfulPaint }
          quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 timeToFirstByteP75 }
        }
      }
    }
  }`, { account: ACCOUNT_TAG, start: fmt(start), end: fmt(end) });
  const rows = viewer.accounts[0]?.rumWebVitalsEventsAdaptiveGroups ?? [];
  const count = rows.reduce((s, r) => s + (r.count ?? 0), 0);
  const ms = (v) => (v == null || v < 0 ? "n/a" : `${(v / 1000).toFixed(0)}ms`);
  console.log(`${days}d · ${count} samples`);
  for (const r of rows) {
    console.log(`LCP  avg=${ms(r.avg?.largestContentfulPaint)}  p75=${ms(r.quantiles?.largestContentfulPaintP75)}`);
    console.log(`INP  avg=${ms(r.avg?.interactionToNextPaint)}  p75=${ms(r.quantiles?.interactionToNextPaintP75)}`);
    console.log(`CLS  avg=${r.avg?.cumulativeLayoutShift}`);
    console.log(`TTFB avg=${ms(r.avg?.timeToFirstByte)}  p75=${ms(r.quantiles?.timeToFirstByteP75)}`);
    console.log(`FCP  avg=${ms(r.avg?.firstContentfulPaint)}`);
  }
} else {
  console.log("usage: node scripts/cf-analytics.mjs <token> <traffic|pages|referrers|countries|webvitals> [days]");
}
