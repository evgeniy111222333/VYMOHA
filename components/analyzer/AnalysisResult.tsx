"use client";

import { useState } from "react";
import { AlertTriangle, BellPlus, Check, ChevronDown, ExternalLink, FileText, ShieldAlert } from "lucide-react";
import type { TenderAnalysis } from "@/src/domain/tender/types";

const verdictLabels = { go: "Можна заходити", maybe: "Потрібна перевірка", "no-go": "Не заходити" };
const statusLabels = { met: "підтверджено", missing: "відсутнє", review: "перевірити", unknown: "невідомо" };

export function AnalysisResult({ analysis }: { analysis: TenderAnalysis }) {
  const [watching, setWatching] = useState(false);
  const amount = analysis.tender.amount
    ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: analysis.tender.currency ?? "UAH", maximumFractionDigits: 0 }).format(analysis.tender.amount)
    : "не вказано";

  async function enableWatch() {
    const response = await fetch("/api/watches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: analysis.tender.externalId }) });
    if (response.ok) setWatching(true);
    else window.location.href = "/dashboard";
  }

  return (
    <section className="analysis-result" id="analysis-result" aria-live="polite">
      <div className="analysis-result__head">
        <div><span className="mono">{analysis.tender.externalId}</span><h2>{analysis.tender.title}</h2><p>{analysis.tender.buyer}</p></div>
        <a href={analysis.tender.sourceUrl} target="_blank" rel="noreferrer">Відкрити в Prozorro <ExternalLink size={14} /></a>
      </div>
      <div className="analysis-summary">
        <div className={`analysis-score analysis-score--${analysis.verdict}`}><strong>{analysis.score}</strong><span>/100</span></div>
        <div><small>Попереднє рішення</small><h3>{verdictLabels[analysis.verdict]}</h3><p>{analysis.summary}</p></div>
        <div className="analysis-summary__facts"><span><small>Бюджет</small><b>{amount}</b></span><span><small>Точність</small><b>{analysis.confidence}%</b></span><span><small>Режим</small><b>{analysis.mode === "ai-enhanced" ? "AI + дані" : "Структурований"}</b></span></div>
      </div>

      <div className="analysis-layout">
        <div className="analysis-panel">
          <div className="analysis-panel__title"><div><FileText size={18} /><h3>Матриця вимог</h3></div><span>{analysis.requirements.length} пунктів</span></div>
          <div className="requirement-list">
            {analysis.requirements.map((item) => <details key={item.id} open={item.status === "missing"}>
              <summary><span className={`req-state req-state--${item.status}`}>{item.status === "met" ? <Check size={13} /> : null}</span><span><b>{item.title}</b><small>{item.description}</small></span><i>{statusLabels[item.status]}</i><ChevronDown size={15} /></summary>
              <div className="requirement-evidence"><span>Джерело</span><a href={item.evidence.source} target="_blank" rel="noreferrer">{item.evidence.label} <ExternalLink size={12} /></a>{item.evidence.excerpt && <q>{item.evidence.excerpt}</q>}</div>
            </details>)}
          </div>
        </div>

        <aside className="analysis-side">
          <div className="analysis-panel">
            <div className="analysis-panel__title"><div><ShieldAlert size={18} /><h3>Ризики</h3></div></div>
            <div className="risk-list">{analysis.risks.map((risk) => <article key={risk.id}><span className={`risk-badge risk-badge--${risk.level}`}>{risk.level}</span><h4>{risk.title}</h4><p>{risk.description}</p><small><AlertTriangle size={13} /> {risk.mitigation}</small></article>)}</div>
          </div>
          <div className="next-actions"><span>Наступні дії</span><ol>{analysis.nextActions.map((action) => <li key={action}>{action}</li>)}</ol></div>
          <button className="button button--dark button--full" onClick={enableWatch} disabled={watching}>{watching ? <><Check size={16} /> Моніторинг увімкнено</> : <><BellPlus size={16} /> Стежити за змінами</>}</button>
        </aside>
      </div>
      <p className="analysis-disclaimer">{analysis.disclaimer}</p>
    </section>
  );
}
