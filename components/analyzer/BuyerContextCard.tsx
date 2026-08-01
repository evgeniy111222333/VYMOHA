import { BarChart3, ExternalLink, ShieldCheck } from "lucide-react";
import type { BuyerContext } from "@/src/domain/tender/types";

export function BuyerContextCard({ context }: { context: BuyerContext }) {
  const percent = Math.round(context.disqualificationRate * 100);
  return (
    <section className="buyer-context" aria-labelledby="buyer-context-title">
      <div className="buyer-context__head">
        <span><BarChart3 size={17} /><b id="buyer-context-title">Контекст замовника</b></span>
        <a href={context.sourceUrl} target="_blank" rel="noreferrer">Історія в Prozorro <ExternalLink size={12} /></a>
      </div>
      <div className="buyer-context__metrics">
        <span><strong>{percent}%</strong><small>кваліфікаційних рішень — відхилення</small></span>
        <span><strong>{context.averageBids}</strong><small>пропозиції в середньому</small></span>
        <span><strong>{context.tendersWithDisqualifications}/{context.sampleSize}</strong><small>тендерів мали відхилення</small></span>
      </div>
      <p><ShieldCheck size={13} /> Вибірка: {context.sampleSize} останніх завершених закупівель за 12 місяців, {context.decidedAwards} рішень. Це статистичний сигнал, не оцінка законності дій замовника.</p>
    </section>
  );
}
