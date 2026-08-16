const INDEXNOW_KEY = "6e160ff9-e3a4-4465-a277-c8ed27d7e41a";
const SITE = "https://vymoha.com";

const targets = [
  SITE,
  `${SITE}/analyze`,
  `${SITE}/guides`,
  ...(await fetch(`${SITE}/sitemap.xml`).then((r) => r.text()))
    .matchAll(/<loc>([^<]+)<\/loc>/g)
    .map((m) => m[1]),
];

const unique = [...new Set(targets)];
const response = await fetch(
  `https://api.indexnow.org/indexnow?url=${encodeURIComponent(unique[0])}&key=${INDEXNOW_KEY}`,
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ host: "vymoha.com", key: INDEXNOW_KEY, keyLocation: `https://vymoha.com/${INDEXNOW_KEY}.txt`, urlList: unique }) },
);
console.log(`IndexNow: ${response.status} ${response.statusText} — ${unique.length} URL`);