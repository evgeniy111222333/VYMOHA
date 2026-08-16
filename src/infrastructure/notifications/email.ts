type TenderChangeEmail = { to: string; tenderExternalId: string; sourceUrl: string; previousVersion: string | null; currentVersion: string };

export async function sendTenderChangeEmail(input: TenderChangeEmail, apiKey?: string, from = "Вимога <updates@vymoha.com>"): Promise<"sent" | "not-configured" | "failed"> {
  if (!apiKey) return "not-configured";
  const subject = `Зміни у закупівлі ${input.tenderExternalId}`;
  const text = [
    "Вимога — моніторинг закупівель Prozorro",
    "",
    `У закупівлі ${input.tenderExternalId} зафіксована нова редакція.`,
    `Попередня редакція: ${input.previousVersion ?? "не зафіксована"}`,
    `Нова редакція: ${input.currentVersion}`,
    "",
    `Відкрити закупівлю: ${input.sourceUrl}`,
    "",
    "Перезапустіть аналіз перед поданням пропозиції.",
    "",
    "Це автоматичне сповіщення моніторингу Вимоги. Ви можете вимкнути його в кабінеті в розділі «Моніторинг».",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#151713;line-height:1.6">
  <div style="padding:24px 0 8px;border-bottom:2px solid #a8ff2a"><span style="font-size:20px;font-weight:700">Вимога</span></div>
  <h1 style="font-size:20px;margin:20px 0 8px">Документацію оновлено</h1>
  <p style="margin:0 0 12px">У закупівлі <b>${escapeHtml(input.tenderExternalId)}</b> зафіксована нова редакція.</p>
  <table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">
    <tr><td style="padding:6px 12px 6px 0;color:#65685f">Попередня редакція</td><td style="padding:6px 0">${escapeHtml(input.previousVersion ?? "не зафіксована")}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#65685f">Нова редакція</td><td style="padding:6px 0">${escapeHtml(input.currentVersion)}</td></tr>
  </table>
  <p style="margin:16px 0"><a href="${escapeHtml(input.sourceUrl)}" style="display:inline-block;padding:10px 18px;background:#151713;color:#a8ff2a;text-decoration:none;border-radius:6px;font-weight:600">Відкрити закупівлю в Prozorro</a></p>
  <p style="color:#65685f">Перезапустіть аналіз перед поданням пропозиції.</p>
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e5e5;color:#8a8f87;font-size:12px">
    <p style="margin:0 0 4px">Це автоматичне сповіщення від Вимоги. Щоб вимкнути — зайдіть у кабінет, розділ «Моніторинг».</p>
    <p style="margin:0">© Вимога — перевірка тендерів Prozorro.</p>
  </div>
</div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? "sent" : "failed";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
