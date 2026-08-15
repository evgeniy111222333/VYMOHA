import { Calculator } from "lucide-react";
import type { PricePosition } from "@/src/domain/tender/types";

export function PriceAnalysis({ positions }: { positions: PricePosition[] }) {
  if (positions.length === 0) return null;
  const hasAnyNumber = positions.some((p) => p.quantity || p.unitPrice || p.totalPrice);
  return (
    <section className="analysis-panel price-analysis" aria-label="Аналіз цін по позиціях">
      <div className="analysis-panel__title">
        <div><Calculator size={18} /><h3>Аналіз цін по позиціях</h3></div>
        <span>{positions.length} позицій</span>
      </div>
      <div className="price-analysis-list">
        {positions.map((pos) => (
          <article key={pos.id} className="price-position">
            <h4>{pos.position}</h4>
            {hasAnyNumber && (
              <div className="price-position__cells">
                {pos.quantity && <span><small>Кількість</small><b>{pos.quantity}</b></span>}
                {pos.unitPrice && <span><small>Ціна за од.</small><b>{pos.unitPrice}</b></span>}
                {pos.totalPrice && <span><small>Сума</small><b>{pos.totalPrice}</b></span>}
              </div>
            )}
            {pos.note && <p>{pos.note}</p>}
            {pos.evidence.excerpt && <q>{pos.evidence.excerpt}</q>}
          </article>
        ))}
      </div>
    </section>
  );
}
