type TenderChangeEmail = { to: string; tenderExternalId: string; sourceUrl: string; previousVersion: string | null; currentVersion: string };

const BRAND = {
  night: "#090b09",
  signal: "#a8ff2a",
  cream: "#f2efe4",
  card: "#14170f",
  border: "rgba(255,255,255,.09)",
  muted: "#8a8f87",
  faint: "#6b7067",
};

export async function sendTenderChangeEmail(input: TenderChangeEmail, apiKey?: string, from = "Вимога <updates@vymoha.com>"): Promise<"sent" | "not-configured" | "failed"> {
  if (!apiKey) return "not-configured";

  const tender = escapeHtml(input.tenderExternalId);
  const prev = formatDate(input.previousVersion);
  const current = formatDate(input.currentVersion);
  const url = escapeHtml(input.sourceUrl);
  const subject = `Зміни у закупівлі ${input.tenderExternalId}`;

  const text = [
    "Вимога — моніторинг закупівель Prozorro",
    "",
    `У закупівлі ${input.tenderExternalId} зафіксована нова редакція.`,
    `Попередня редакція: ${prev}`,
    `Нова редакція: ${current}`,
    "",
    `Відкрити закупівлю: ${input.sourceUrl}`,
    "",
    "Перезапустіть аналіз перед поданням пропозиції.",
    "",
    "Це автоматичне сповіщення. Вимкнути — у кабінеті, розділ «Моніторинг».",
  ].join("\n");

  const html = `<!doctype html><html lang="uk"><body style="margin:0;padding:0;background:${BRAND.night};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.night}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.cream}">

      <tr>
        <td style="padding:0 0 22px;border-bottom:1px solid rgba(168,255,42,.25)">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td><img src="https://vymoha.com/brand-mark-v2.png" width="30" height="30" alt="" style="display:block;border-radius:7px" /></td>
            <td style="padding-left:10px;font-size:18px;font-weight:800;letter-spacing:.03em;color:${BRAND.cream}">ВИМ<span style="color:${BRAND.signal}">О</span>ГА</td>
          </tr></table>
        </td>
      </tr>

      <tr><td style="padding:34px 0 10px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${BRAND.signal}">Моніторинг · нова редакція</td></tr>

      <tr><td style="padding:0 0 16px;font-size:30px;font-weight:800;line-height:1.12;letter-spacing:-.02em;color:${BRAND.cream}">Тендер змінили.<br />Перевірте нову редакцію.</td></tr>

      <tr><td style="padding:0 0 26px;font-size:15px;line-height:1.6;color:${BRAND.muted}">У закупівлі <b style="color:${BRAND.cream}">${tender}</b> з'явилася нова редакція. Вимоги могли змінитись — перезапустіть аналіз.</td></tr>

      <tr><td style="padding:0 0 30px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid ${BRAND.border};font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.faint}">Попередня редакція</td>
            <td style="padding:16px 20px;border-bottom:1px solid ${BRAND.border};font-size:13px;text-align:right;color:${BRAND.cream}">${prev}</td>
          </tr>
          <tr>
            <td style="padding:16px 20px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.faint}">Нова редакція</td>
            <td style="padding:16px 20px;font-size:13px;text-align:right;color:${BRAND.cream}"><span style="display:inline-block;background:${BRAND.signal};color:${BRAND.night};padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;margin-right:8px">ЗМІНА</span>${current}</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 34px">
        <a href="${url}" style="display:inline-block;background:${BRAND.signal};color:${BRAND.night};padding:14px 26px;border-radius:9px;font-size:15px;font-weight:700;text-decoration:none">Відкрити закупівлю в Prozorro →</a>
      </td></tr>

      <tr><td style="padding:22px 0 0;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.7;color:${BRAND.faint}">
        Ви отримуєте це сповіщення, бо ввімкнули моніторинг цієї закупівлі.<br />
        Вимкнути — у кабінеті, розділ «Моніторинг» · <a href="https://vymoha.com" style="color:${BRAND.signal};text-decoration:none">vymoha.com</a>
      </td></tr>

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

function formatDate(iso: string | null): string {
  if (!iso) return "не зафіксована";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
