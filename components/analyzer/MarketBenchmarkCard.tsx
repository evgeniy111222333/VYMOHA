import { AlertTriangle, BarChart3, ExternalLink, Target } from "lucide-react";
import type { MarketContext } from "@/src/domain/tender/types";

export function MarketBenchmarkCard({ context, expectedAmount, currency }: { context: MarketContext; expectedAmount?: number; currency?: string }) {
  const discountPercent = context.medianDiscount !== null ? Math.round(context.medianDiscount * 100) : null;
  const target = context.medianDiscount !== null && expectedAmount
    ? Math.round(expectedAmount * (1 - context.medianDiscount))
    : null;
  const currencyLabel = currency ?? "UAH";
  const scopeLabel = context.scope === "buyer" ? "цього замовника" : `CPV ${context.cpvClass}${context.region ? ` · ${context.region}` : ""}`;
  const competitionLabel = { low: "низька", normal: "звичайна", high: "висока", unknown: "невідомо" }[context.competitionLevel];

  return (
    <section className="buyer-context market-benchmark" aria-labelledby="market-benchmark-title">
      <div className="buyer-context__head">
        <span><BarChart3 size={17} /><b id="market-benchmark-title">Ринковий бенчмарк</b></span>
        <a href={context.sourceUrl} target="_blank" rel="noreferrer">Аналоги в Prozorro <ExternalLink size={12} /></a>
      </div>
      <div className="buyer-context__metrics">
        <span>
          <strong>{discountPercent !== null ? `−${discountPercent}%` : "н/д"}</strong>
          <small>медіанний дисконт переможця</small>
        </span>
        <span>
          <strong>{target !== null ? new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(target) : "н/д"}</strong>
          <small>цільова ціна, {currencyLabel}</small>
        </span>
        <span>
          <strong>{context.medianParticipants !== null ? context.medianParticipants : "н/д"}</strong>
          <small>учасників у середньому · конкуренція {competitionLabel}</small>
        </span>
      </div>
      <p>
        {context.confidence === "low" && <AlertTriangle size={13} />}
        {context.confidence === "high" && <Target size={13} />}
        Вибірка: {context.sampleSize} аналогічних закупівель {scopeLabel} за {context.windowMonths} міс.
        {context.singleBidderRate !== null && context.singleBidderRate >= 0.5 && (
          <> У {Math.round(context.singleBidderRate * 100)}% з них була ≤1 пропозиція — ознака низької конкуренції.</>
        )}
        {context.topCompetitors.length > 0 && (
          <> Повторювані переможці: {context.topCompetitors.slice(0, 3).map((c) => `ЄДРПОУ ${c.edrpou} (${c.wins})`).join(", ")}.</>
        )}
      </p>
    </section>
  );
}
