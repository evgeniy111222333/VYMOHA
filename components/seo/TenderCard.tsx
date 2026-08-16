import { ArrowUpRight } from "lucide-react";
import { cpvDivisionName } from "@/src/content/cpv";
import type { PublicTenderCard } from "@/src/infrastructure/storage/repository";

const verdictLabels: Record<string, string> = {
  go: "Можна заходити",
  maybe: "Потрібна перевірка",
  "no-go": "Не заходити",
};

function formatAmount(amountMinor: number | null, currency: string | null): string | null {
  if (amountMinor === null) return null;
  const major = amountMinor / 100;
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: currency ?? "UAH",
    maximumFractionDigits: 0,
  }).format(major);
}

export function TenderCard({ card }: { card: PublicTenderCard }) {
  const amount = formatAmount(card.amountMinor, card.currency);
  return (
    <a href={`/analyze/${card.tenderExternalId}`}>
      <span className="mono">{card.tenderExternalId}</span>
      <small>{card.buyer}</small>
      <h2>{card.title}</h2>
      <p>
        Бал <b>{card.score}/100</b> · {verdictLabels[card.verdict] ?? card.verdict}
        {amount ? ` · ${amount}` : ""}
      </p>
      <div>
        {cpvDivisionName(card.cpvCode) ?? card.cpvLabel ?? card.cpvCode ?? "Закупівля"}
        <ArrowUpRight size={16} />
      </div>
    </a>
  );
}
