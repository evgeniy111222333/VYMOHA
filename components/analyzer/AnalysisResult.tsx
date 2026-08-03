"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, ArrowUpRight, BellPlus, Check, ChevronDown, Coins, ExternalLink, FileCheck2, FileText, LockKeyhole, MessageSquareText, ScanSearch, ShieldAlert } from "lucide-react";
import type { TenderAnalysis } from "@/src/domain/tender/types";
import { formatSignals, SIGNAL_UNIT } from "@/src/domain/billing/presentation";
import { BuyerContextCard } from "./BuyerContextCard";
import { ScoreExplanation } from "./ScoreExplanation";
import { TenderDocumentList } from "./TenderDocumentList";

import { RequiredDocumentsChecklist } from "./RequiredDocumentsChecklist";
import { ScoreGauge } from "./ScoreGauge";
import { ProzorroLifecycleTimeline } from "./ProzorroLifecycleTimeline";
import { TenderRevisionsDiff } from "./TenderRevisionsDiff";

const verdictLabels = { go: "Можна заходити", maybe: "Потрібна перевірка", "no-go": "Не заходити" };
const statusLabels = { met: "підтверджено", missing: "відсутнє", review: "перевірити", unknown: "невідомо" };

const statusDisplay: Record<string, { label: string; badge: string }> = {
  "active.tendering": { label: "Прийом пропозицій", badge: "status-pill--active" },
  "active.pre-qualification": { label: "Прекваліфікація", badge: "status-pill--active" },
  "active.pre-qualification.stand-still": { label: "Прекваліфікація (Оскарження)", badge: "status-pill--warning" },
  "active.auction": { label: "Аукціон", badge: "status-pill--active" },
  "active.qualification": { label: "Кваліфікація переможця", badge: "status-pill--warning" },
  "active.awarded": { label: "Укладення договору", badge: "status-pill--warning" },
  "complete": { label: "Завершено", badge: "status-pill--muted" },
  "cancelled": { label: "Скасовано", badge: "status-pill--danger" },
  "unsuccessful": { label: "Не відбувся", badge: "status-pill--danger" },
};

type AnalysisResultProps = {
  analysis: TenderAnalysis;
  signedIn?: boolean;
  initialCredits?: number;
  signInHref?: string;
  analyzeHref?: string;
  billingHref?: string;
};

export function AnalysisResult({ analysis, signedIn = false, initialCredits = 0, signInHref = "/dashboard", analyzeHref = "/analyze", billingHref = "/dashboard/billing" }: AnalysisResultProps) {
  const [watching, setWatching] = useState(false);
  const amount = analysis.tender.amount
    ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: analysis.tender.currency ?? "UAH", maximumFractionDigits: 0 }).format(analysis.tender.amount)
    : "не вказано";

  const isQuick = (analysis.analysisTier ?? "quick") === "quick";
  const showUpsell = isQuick && analysis.verdict !== "no-go";

  const statusInfo = statusDisplay[analysis.tender.status] || { label: analysis.tender.status || "Очікує", badge: "status-pill--muted" };
  const vatText = analysis.tender.vatIncluded === true ? "(з ПДВ)" : analysis.tender.vatIncluded === false ? "(без ПДВ)" : "";

  const minStepFormatted = analysis.tender.minimalStepAmount
    ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: analysis.tender.currency ?? "UAH", maximumFractionDigits: 0 }).format(analysis.tender.minimalStepAmount)
    : "Не вказано";

  const minStepPercent = (analysis.tender.amount && analysis.tender.minimalStepAmount)
    ? ` (${((analysis.tender.minimalStepAmount / analysis.tender.amount) * 100).toFixed(1)}%)`
    : "";

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
        <ScoreGauge score={analysis.score} verdict={analysis.verdict} />
        <div><small>Попереднє рішення</small><h3>{verdictLabels[analysis.verdict]}</h3><p>{analysis.summary}</p></div>
        <div className="analysis-summary__facts"><span><small>Бюджет</small><b>{amount} <small className="vat-tag">{vatText}</small></b></span><span><small>Покриття даних</small><b>{analysis.confidence}%</b></span><span><small>Режим</small><b>{analysis.mode === "ai-enhanced" ? <><FileCheck2 size={12} /> Документи</> : "Швидка перевірка"}</b></span>{analysis.creditsCharged ? <span><small>Використано</small><b><Coins size={12} /> {formatSignals(analysis.creditsCharged, true)}</b></span> : null}</div>
      </div>

      <div className="tender-passport-bar">
        <div className="passport-item">
          <small>Оголошено</small>
          <b>{analysis.tender.datePublished ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(analysis.tender.datePublished)) : "—"}</b>
        </div>
        <div className="passport-item">
          <small>Мінімальний крок</small>
          <b>{minStepFormatted}<small>{minStepPercent}</small></b>
        </div>
        <div className="passport-item">
          <small>Забезпечення</small>
          <b>{analysis.tender.guaranteeAmount ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: analysis.tender.guaranteeCurrency ?? "UAH", maximumFractionDigits: 0 }).format(analysis.tender.guaranteeAmount) : "Без застави"}</b>
        </div>
      </div>

      <ProzorroLifecycleTimeline
        status={analysis.tender.status}
        datePublished={analysis.tender.datePublished}
        deadline={analysis.tender.deadline}
        auctionStartDate={analysis.tender.auctionStartDate}
        hasAuction={analysis.tender.hasAuction}
      />

      {analysis.revisionsAnalysis && (
        <TenderRevisionsDiff analysis={analysis.revisionsAnalysis} />
      )}

      {analysis.analysisTier === "expert" && analysis.tender.vatIncluded === false && (
        <div className="expert-vat-warning">
          <AlertCircle size={18} />
          <div>
            <b>Експертне застереження щодо ПДВ:</b>
            <p>Замовник вказав очікувану вартість <b>БЕЗ ПДВ</b>. Якщо ваша компанія є платником ПДВ (+20%), обов’язково враховуйте податкові зобов’язання при розрахунку маржинальності та формуванні підсумкової ціни пропозиції!</p>
          </div>
        </div>
      )}

      <div className="analysis-context-grid">
        <ScoreExplanation analysis={analysis} />
        {analysis.buyerContext && <BuyerContextCard context={analysis.buyerContext} />}
      </div>

      {showUpsell && <UpgradeCta
        analysis={analysis}
        signedIn={signedIn}
        initialCredits={initialCredits}
        signInHref={signInHref}
        analyzeHref={analyzeHref}
        billingHref={billingHref}
      />}

      {analysis.requiredDocumentsChecklist && analysis.requiredDocumentsChecklist.length > 0 && (
        <RequiredDocumentsChecklist items={analysis.requiredDocumentsChecklist} />
      )}

      <TenderDocumentList analysis={analysis} />

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
          {analysis.nextActions.length > 0 && <div className="next-actions"><span>Наступні дії</span><ol>{analysis.nextActions.map((action) => <li key={action}>{action}</li>)}</ol></div>}
          <button className="button button--dark button--full" onClick={enableWatch} disabled={watching}>{watching ? <><Check size={16} /> Моніторинг увімкнено</> : <><BellPlus size={16} /> Стежити за змінами</>}</button>
        </aside>
      </div>
      {analysis.mode === "ai-enhanced" && ((analysis.questionsToBuyer?.length ?? 0) > 0 || (analysis.documentCoverage?.length ?? 0) > 0) && <div className="ai-intelligence-grid">
        <section className="analysis-panel"><div className="analysis-panel__title"><div><FileCheck2 size={18} /><h3>Покриття документів</h3></div><span>{analysis.documentCoverage?.length ?? 0}</span></div><div className="coverage-list">{analysis.documentCoverage?.map((item) => <div key={`${item.title}:${item.status}`}><span className={`coverage-dot coverage-dot--${item.status}`} /><span><b>{item.title}</b><small>{item.notes}</small></span><i>{item.status === "read" ? "прочитано" : item.status === "partial" ? "частково" : "недоступно"}</i></div>)}</div></section>
        <section className="analysis-panel"><div className="analysis-panel__title"><div><MessageSquareText size={18} /><h3>Питання замовнику</h3></div></div><ol className="buyer-questions">{analysis.questionsToBuyer?.map((question) => <li key={question}>{question}</li>)}</ol></section>
      </div>}
      <p className="analysis-disclaimer">{analysis.disclaimer}</p>
    </section>
  );
}

function UpgradeCta({
  analysis,
  signedIn,
  initialCredits,
  signInHref,
  analyzeHref,
  billingHref,
}: {
  analysis: TenderAnalysis;
  signedIn: boolean;
  initialCredits: number;
  signInHref: string;
  analyzeHref: string;
  billingHref: string;
}) {
  const verdictWord = analysis.verdict === "go" ? "виглядає перспективною" : "потребує додаткової перевірки";
  const hasCredits = initialCredits >= 12;
  const ctaHref = !signedIn
    ? signInHref
    : hasCredits
      ? `${analyzeHref}?source=${encodeURIComponent(analysis.tender.externalId)}&tier=deep`
      : billingHref;
  const ctaLabel = !signedIn
    ? "Увійти, щоб продовжити"
    : hasCredits
      ? "Запустити поглиблений аналіз"
      : "Купити кредити";
  const CtaIcon = !signedIn ? LockKeyhole : hasCredits ? ScanSearch : Coins;

  return (
    <aside className="upgrade-cta" aria-label="Перейти до повного аналізу">
      <div className="upgrade-cta__intro">
        <span className="section-kicker">Що дасть повний аналіз</span>
        <h3>{analysis.verdict === "go" ? "Закупівля " : "Сирий висновок "} <em>{verdictWord}</em> — але без читання документів це лише перший фільтр.</h3>
      </div>
      <ul className="upgrade-cta__list">
        <li><ScanSearch size={16} /> AI прочитає тендерну документацію та витягне конкретні кваліфікаційні вимоги</li>
        <li><FileCheck2 size={16} /> Покаже покриття кожного файлу та підготує запит на роз&rsquo;яснення</li>
        <li><MessageSquareText size={16} /> Сформулює 5–8 питань замовнику, готові до вставки в Prozorro</li>
      </ul>
      <div className="upgrade-cta__price">
        <span><b>12 {SIGNAL_UNIT}ів</b> · 1 поглиблений аналіз</span>
        <span>≈ {Math.round(14900 / 12)} грн / аналіз при пакеті «Спроба»</span>
      </div>
      <a className="button button--primary button--full" href={ctaHref}>
        <CtaIcon size={17} /> {ctaLabel} <ArrowUpRight size={16} />
      </a>
      <small>Аналіз без реєстрації вже врахував структуру Prozorro, історію замовника та крайні строки. Повний режим додає розбір PDF і діалог з AI.</small>
    </aside>
  );
}

