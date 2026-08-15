import { Scale } from "lucide-react";
import type { ContractRiskCategory, ContractRiskItem, ContractRiskSeverity } from "@/src/domain/tender/types";

const categoryLabels: Record<ContractRiskCategory, string> = {
  fine: "Штраф",
  penalty: "Пеня",
  force_majeure: "Форс-мажор",
  termination: "Розірвання",
  payment: "Оплата",
  guarantee: "Гарантія",
  other: "Інше",
};

const severityLabels: Record<ContractRiskSeverity, string> = {
  critical: "критичний",
  high: "високий",
  medium: "середній",
  low: "низький",
};

export function ContractRiskMatrix({ items }: { items: ContractRiskItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="analysis-panel contract-risk-matrix" aria-label="Матриця ризиків договору">
      <div className="analysis-panel__title">
        <div><Scale size={18} /><h3>Матриця ризиків договору</h3></div>
        <span>{items.length} пунктів</span>
      </div>
      <div className="contract-risk-list">
        {items.map((item) => (
          <article key={item.id} className="contract-risk-item">
            <div className="contract-risk-item__head">
              <span className="contract-risk-cat">{categoryLabels[item.category]}</span>
              <span className={`risk-badge risk-badge--${item.severity}`}>{severityLabels[item.severity]}</span>
            </div>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
            {item.evidence.excerpt && <q>{item.evidence.excerpt}</q>}
          </article>
        ))}
      </div>
    </section>
  );
}
