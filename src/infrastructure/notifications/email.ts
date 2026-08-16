type TenderChangeEmail = { to: string; tenderExternalId: string; sourceUrl: string; previousVersion: string | null; currentVersion: string };

export type HealthAlertInput = { to: string; issues: Array<{ check: string; severity: "warn" | "error"; detail: string }> };

const BRAND = {
  night: "#080a08",
  card: "#101410",
  cardHeader: "#0d110d",
  signal: "#a8ff2a",
  cream: "#f5f2e8",
  border: "#232b21",
  borderSubtle: "#192117",
  muted: "#9ba396",
  faint: "#61685d",
};

export async function sendTenderChangeEmail(input: TenderChangeEmail, apiKey?: string, from = "VYMOHA <updates@vymoha.com>"): Promise<"sent" | "not-configured" | "failed"> {
  if (!apiKey) return "not-configured";

  const tender = escapeHtml(input.tenderExternalId);
  const prev = formatDate(input.previousVersion);
  const current = formatDate(input.currentVersion);
  const url = escapeHtml(input.sourceUrl);
  const appAnalyzeUrl = `https://vymoha.com/analyze?source=${encodeURIComponent(input.tenderExternalId)}`;
  const subject = `⚡ Оновлення закупівлі ${input.tenderExternalId} — Нова редакція`;

  const text = [
    "ВИМОГА — Моніторинг закупівель Prozorro",
    "==================================================",
    "УВАГА: Замовник оприлюднив нову редакцію закупівлі!",
    "",
    `Ідентифікатор: ${input.tenderExternalId}`,
    `Попередня версія: ${prev}`,
    `Поточна редакція: ${current}`,
    "",
    `Перевірити зміни у Вимозі: ${appAnalyzeUrl}`,
    `Переглянути на Prozorro: ${input.sourceUrl}`,
    "",
    "Рекомендуємо перевірити вимоги перед поданням пропозиції.",
    "==================================================",
    "Керувати моніторингом: https://vymoha.com/dashboard/monitoring",
  ].join("\n");

  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.night};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.night};min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 14px 50px;">
      
      <!-- Main Card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.75);">
        
        <!-- Header with Exact Brand Mark -->
        <tr>
          <td style="padding:22px 28px;background:${BRAND.cardHeader};border-bottom:1px solid ${BRAND.borderSubtle};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left" style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">
                        <!-- Exact Vector Brand Icon -->
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width:36px;height:36px;background:#0d110d;border:1.5px solid #a8ff2a;border-radius:9px;">
                          <tr>
                            <td align="center" valign="middle" style="padding:0;text-align:center;height:36px;width:36px;">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
                                <path d="M7 6C4.8 8.2 4.8 15.8 7 18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M17 6C19.2 8.2 19.2 15.8 17 18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                                <path d="M10 13H15" stroke="#a8ff2a" stroke-width="2.5" stroke-linecap="round"/>
                                <rect x="9" y="10" width="3" height="4" fill="#a8ff2a" fill-opacity="0.3"/>
                              </svg>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;font-size:21px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1;">
                        ВИМ<span style="color:${BRAND.signal};">О</span>ГА
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 12px;border-radius:20px;background:#141d13;border:1px solid #2a4025;color:${BRAND.signal};font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">
                    ● МОНІТОРИНГ
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Content Area -->
        <tr>
          <td style="padding:32px 28px 28px;">

            <!-- Sleek Neon Status Pill (No ugly brown!) -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="padding:5px 11px;border-radius:6px;background:#152014;border:1px solid #2d4528;color:${BRAND.signal};font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                  ⚡ НОВА РЕДАКЦІЯ ТЕНДЕРУ
                </td>
              </tr>
            </table>

            <!-- Heading -->
            <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-0.02em;color:#ffffff;">
              Замовник оновив умови закупівлі
            </h1>

            <!-- Subtitle -->
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:${BRAND.muted};">
              Вимоги тендерної документації або проект договору оновлено. Перевірте зміни у Вимозі, щоб заздалегідь виявити нові ризики та вберегти пропозицію від дискваліфікації.
            </p>

            <!-- Tender Code Box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;background:#141913;border:1px solid #253123;border-radius:10px;">
              <tr>
                <td style="padding:13px 18px;">
                  <div style="font-size:10px;color:#71786e;text-transform:uppercase;letter-spacing:.08em;font-family:'SFMono-Regular',Consolas,monospace;font-weight:700;margin-bottom:4px;">
                    Номер закупівлі Prozorro
                  </div>
                  <div style="font-size:16px;color:${BRAND.signal};font-family:'SFMono-Regular',Consolas,monospace;font-weight:700;letter-spacing:.02em;">
                    ${tender}
                  </div>
                </td>
              </tr>
            </table>

            <!-- Comparison Table -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#131712;border:1px solid #20281d;border-radius:11px;overflow:hidden;">
              <tr>
                <td style="padding:13px 16px;border-bottom:1px solid #1b2218;font-size:11px;color:#757c71;text-transform:uppercase;letter-spacing:.06em;font-family:'SFMono-Regular',Consolas,monospace;font-weight:600;width:42%;">
                  Попередня версія
                </td>
                <td style="padding:13px 16px;border-bottom:1px solid #1b2218;font-size:13px;color:#9ca297;text-align:right;font-family:'SFMono-Regular',Consolas,monospace;">
                  ${prev}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:11px;color:${BRAND.signal};text-transform:uppercase;letter-spacing:.06em;font-family:'SFMono-Regular',Consolas,monospace;font-weight:700;">
                  🟢 Нова редакція
                </td>
                <td style="padding:14px 16px;font-size:13px;color:#ffffff;font-weight:700;text-align:right;font-family:'SFMono-Regular',Consolas,monospace;">
                  ${current}
                </td>
              </tr>
            </table>

            <!-- CTA Primary Button -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td align="center">
                  <a href="${appAnalyzeUrl}" style="display:block;width:100%;box-sizing:border-box;background:${BRAND.signal};color:#090b09;padding:15px 22px;border-radius:9px;font-size:15px;font-weight:800;text-align:center;text-decoration:none;letter-spacing:-0.01em;box-shadow:0 4px 16px rgba(168,255,42,0.22);">
                    Перевірити нову редакцію у Вимозі →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Secondary Link -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-top:4px;">
                  <a href="${url}" style="display:inline-block;color:#7d8579;font-size:12px;text-decoration:underline;padding:4px 8px;font-family:'SFMono-Regular',Consolas,monospace;">
                    Переглянути закупівлю на Prozorro ↗
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 28px 24px;background:${BRAND.cardHeader};border-top:1px solid ${BRAND.borderSubtle};font-size:12px;line-height:1.6;color:${BRAND.faint};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:8px;font-size:11px;color:#676e63;">
                  Ви отримали це сповіщення через активний моніторинг закупівлі <strong style="color:#858d80;">${tender}</strong>.
                </td>
              </tr>
              <tr>
                <td style="font-size:11px;color:#50574d;">
                  <a href="https://vymoha.com/dashboard/monitoring" style="color:${BRAND.signal};text-decoration:none;font-weight:600;">Налаштування моніторингу</a> · 
                  <a href="https://vymoha.com" style="color:#7d8579;text-decoration:none;">vymoha.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? "sent" : "failed";
}

function formatDate(iso: string | null): string {
  if (!iso) return "не зафіксована";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendHealthAlertEmail(input: HealthAlertInput, apiKey?: string, from = "VYMOHA <updates@vymoha.com>"): Promise<"sent" | "not-configured" | "failed"> {
  if (!apiKey) return "not-configured";

  const subject = `⚠️ Вимога: проблеми з SEO-моніторингом (${input.issues.length})`;
  const issueRows = input.issues.map((issue) => {
    const label = issue.severity === "error" ? "🔴 Критично" : "🟡 Попередження";
    return `${label} — ${issue.check}\n${escapeHtml(issue.detail)}`;
  }).join("\n\n");

  const text = [
    "ВИМОГА — SEO-моніторинг",
    "==============================",
    "Виявлено проблеми з фоновим наповненням:",
    "",
    issueRows,
    "",
    "Перевірити стан: https://vymoha.com/dashboard/admin",
    "==============================",
  ].join("\n");

  const html = `<!doctype html>
<html lang="uk"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BRAND.night};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.night};">
  <tr><td align="center" style="padding:40px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
      <tr><td style="padding:22px 28px;background:${BRAND.cardHeader};border-bottom:1px solid ${BRAND.borderSubtle};font-size:19px;font-weight:900;color:#ffffff;">ВИМ<span style="color:${BRAND.signal};">О</span>ГА <span style="font-size:12px;color:${BRAND.faint};font-weight:600;">· моніторинг</span></td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#ffffff;">Проблеми з фоновим наповненням</h1>
        ${input.issues.map((issue) => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;background:#141913;border:1px solid #253123;border-radius:10px;">
            <tr><td style="padding:13px 16px;">
              <div style="font-size:10px;color:${issue.severity === "error" ? "#ff6b6b" : "#ffb800"};text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:4px;">${issue.severity === "error" ? "Критично" : "Попередження"}</div>
              <div style="font-size:13px;color:${BRAND.muted};">${escapeHtml(issue.detail)}</div>
            </td></tr>
          </table>`).join("")}
        <a href="https://vymoha.com/dashboard/admin" style="display:block;background:${BRAND.signal};color:#090b09;padding:14px 20px;border-radius:9px;font-size:14px;font-weight:800;text-align:center;text-decoration:none;margin-top:16px;">Перевірити стан →</a>
      </td></tr>
      <tr><td style="padding:18px 28px;background:${BRAND.cardHeader};border-top:1px solid ${BRAND.borderSubtle};font-size:11px;color:${BRAND.faint};">Автоматичне сповіщення SEO-моніторингу vymoha.com</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? "sent" : "failed";
}


