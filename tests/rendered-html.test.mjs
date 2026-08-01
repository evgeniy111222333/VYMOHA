import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const baseUrl = "http://127.0.0.1:3199";
let server;

before(async () => {
  server = spawn(process.execPath, ["node_modules/vinext/dist/cli.js", "dev", "--port", "3199", "--hostname", "127.0.0.1"], {
    cwd: new URL("../", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Worker preview did not start.\n${output}`);
});

after(() => { server?.kill(); });

async function render(path = "/") {
  return fetch(`${baseUrl}${path}`, { headers: { accept: "text/html" } });
}

test("server-renders the production marketing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="uk"/i);
  assert.match(html, /Вимога/);
  assert.match(html, /300 сторінок/);
  assert.match(html, /Запустити аналіз/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("renders crawlable guide and legal pages", async () => {
  const [guide, privacy, robots] = await Promise.all([
    render("/guides/dokumenty-dlia-uchasti"),
    render("/privacy"),
    render("/robots.txt"),
  ]);
  assert.equal(guide.status, 200);
  assert.match(await guide.text(), /Документи для участі/);
  assert.equal(privacy.status, 200);
  assert.match(await privacy.text(), /Конфіденційність/);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap:/);
});

test("renders custom authentication and protects the dashboard", async () => {
  const signIn = await render("/auth/sign-in");
  assert.equal(signIn.status, 200);
  const html = await signIn.text();
  assert.match(html, /Раді бачити знову/);
  assert.match(html, /Пошта або номер телефону/);
  assert.doesNotMatch(html, /signin-with-chatgpt|OpenAI/i);

  const dashboard = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  assert.equal(dashboard.status, 307);
  assert.match(dashboard.headers.get("location") ?? "", /\/auth\/sign-in\?return_to=/);
});
