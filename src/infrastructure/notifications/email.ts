type TenderChangeEmail = { to: string; tenderExternalId: string; sourceUrl: string; previousVersion: string | null; currentVersion: string };

export async function sendTenderChangeEmail(input: TenderChangeEmail, apiKey?: string, from = "Вимога <updates@vymoha.app>"): Promise<"sent" | "not-configured" | "failed"> {
  if (!apiKey) return "not-configured";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from, to: [input.to], subject: `Зміни у закупівлі ${input.tenderExternalId}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#151713"><h1>Документацію оновлено</h1><p>У закупівлі <b>${escapeHtml(input.tenderExternalId)}</b> зафіксована нова редакція.</p><p>Попередня: ${escapeHtml(input.previousVersion ?? "не зафіксована")}<br>Нова: ${escapeHtml(input.currentVersion)}</p><p><a href="${escapeHtml(input.sourceUrl)}">Відкрити закупівлю у Prozorro</a></p><p style="color:#65685f">Перезапустіть аналіз перед поданням пропозиції.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? "sent" : "failed";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
