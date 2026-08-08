import type { TenderRevision, TenderRevisionsAnalysis } from "@/src/domain/tender/types";

export function buildRevisionsSummary(revisions: TenderRevision[]): TenderRevisionsAnalysis {
  if (!revisions || revisions.length === 0) {
    return {
      hasRevisions: false,
      impactLevel: "info",
      summary: "Замовник не вносив редакційних змін або коригувань документації від моменту первинної публікації закупівлі.",
      actionRequired: "Додаткових дій чи переподання пакету через зміни не потрібно.",
      revisions: [],
    };
  }

  const hasDeadlineChange = revisions.some((r) => r.changes.some((c) => c.path.includes("/tenderPeriod/endDate")));
  const hasValueChange = revisions.some((r) => r.changes.some((c) => c.path.includes("/value/amount")));
  const hasDocChange = revisions.some((r) => r.changes.some((c) => c.path.includes("/documents")));

  let impactLevel: "critical" | "warning" | "info" = "info";
  if (hasDeadlineChange || hasValueChange) {
    impactLevel = "critical";
  } else if (hasDocChange) {
    impactLevel = "warning";
  }

  const changeSummaries: string[] = [];
  revisions.forEach((rev, idx) => {
    const formattedDate = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(rev.date));
    const labels = Array.from(new Set(rev.changes.map((c) => c.fieldLabel))).join(", ");
    changeSummaries.push(`Редакція #${idx + 1} (${formattedDate}): ${labels || "Оновлення параметрів"}`);
  });

  let summary = `Замовник провів ${revisions.length} етап(ів) внесення змін до закупівлі. `;
  summary += changeSummaries.join("; ") + ".";

  let actionRequired = "Ознайомтеся з оновленою редакцією документації.";
  if (hasDeadlineChange) {
    actionRequired = "Замовник змінив кінцевий строк подання! Звірте графік підготовки та термін дії банківської гарантії.";
  } else if (hasDocChange) {
    actionRequired = "Замовник оновив тендерні файли або додатки. Перевірте, чи не змінювалися форми довідок у новій редакції.";
  }

  return {
    hasRevisions: true,
    impactLevel,
    summary,
    actionRequired,
    revisions,
  };
}
