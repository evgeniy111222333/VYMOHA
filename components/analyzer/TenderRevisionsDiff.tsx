"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, ArrowRight, ChevronDown, Clock, History, Info } from "lucide-react";
import type { TenderRevisionsAnalysis } from "@/src/domain/tender/types";

type TenderRevisionsDiffProps = {
  analysis: TenderRevisionsAnalysis;
};

export function TenderRevisionsDiff({ analysis }: TenderRevisionsDiffProps) {
  const [expandedRev, setExpandedRev] = useState<string | null>(analysis.revisions[0]?.id ?? null);

  if (!analysis.hasRevisions || analysis.revisions.length === 0) {
    return (
      <div className="tender-revisions-card is-empty">
        <div className="tender-revisions-card__empty-head">
          <History size={20} />
          <div>
            <h4>Історія змін ТД (Prozorro Revisions)</h4>
            <p>Замовник не вносив редакційних змін або патчів до цієї закупівлі з моменту публікації.</p>
          </div>
        </div>
      </div>
    );
  }

  const impactBannerClass =
    analysis.impactLevel === "critical"
      ? "rev-impact--critical"
      : analysis.impactLevel === "warning"
        ? "rev-impact--warning"
        : "rev-impact--info";

  return (
    <div className="tender-revisions-card">
      <div className="tender-revisions-card__header">
        <div className="tender-revisions-card__title">
          <History size={20} />
          <div>
            <span className="tender-revisions-card__kicker">Аудит закупівлі Prozorro</span>
            <h3>Історія змін та AI-оцінка впливу</h3>
          </div>
        </div>
        <span className="tender-revisions-card__count">
          {analysis.revisions.length} {analysis.revisions.length === 1 ? "редакція" : "редакції"}
        </span>
      </div>

      <div className={`rev-impact-banner ${impactBannerClass}`}>
        {analysis.impactLevel === "critical" ? (
          <AlertOctagon size={20} />
        ) : analysis.impactLevel === "warning" ? (
          <AlertTriangle size={20} />
        ) : (
          <Info size={20} />
        )}
        <div>
          <b>
            {analysis.impactLevel === "critical"
              ? "Критичний вплив на пропозицію!"
              : analysis.impactLevel === "warning"
                ? "Увага: Внесено зміни до документів або умов!"
                : "Інформаційні правки замовника"}
          </b>
          <p>{analysis.summary}</p>
          <div className="rev-impact-banner__action">
            <ArrowRight size={14} />
            <span><b>Рекомендація Vymoha:</b> {analysis.actionRequired}</span>
          </div>
        </div>
      </div>

      <div className="rev-timeline-list">
        {analysis.revisions.map((rev, idx) => {
          const isExpanded = expandedRev === rev.id;
          const formattedDate = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(rev.date));

          return (
            <div key={rev.id} className={`rev-item ${isExpanded ? "is-expanded" : ""}`}>
              <div
                className="rev-item__header"
                onClick={() => setExpandedRev(isExpanded ? null : rev.id)}
              >
                <div className="rev-item__meta">
                  <span className="rev-item__badge">Редакція #{analysis.revisions.length - idx}</span>
                  <span className="rev-item__date"><Clock size={13} /> {formattedDate}</span>
                  <span className="rev-item__author">{rev.author}</span>
                </div>
                <div className="rev-item__toggle">
                  <small>{rev.changes.length} {rev.changes.length === 1 ? "зміна" : "змін"}</small>
                  <ChevronDown size={16} className={`chevron ${isExpanded ? "is-open" : ""}`} />
                </div>
              </div>

              {isExpanded && (
                <div className="rev-item__body">
                  <div className="rev-changes-grid">
                    {rev.changes.map((change, cIdx) => (
                      <div key={cIdx} className="rev-change-row">
                        <div className="rev-change-row__left">
                          <span className={`op-chip op-chip--${change.op}`}>{change.op}</span>
                          <b>{change.fieldLabel}</b>
                          <code className="mono-path">{change.path}</code>
                        </div>

                        {(change.oldValue || change.newValue) && (
                          <div className="rev-change-row__diff">
                            {change.oldValue && (
                              <div className="diff-val diff-val--old">
                                <small>Було</small>
                                <span>{change.oldValue}</span>
                              </div>
                            )}
                            {change.oldValue && change.newValue && <ArrowRight size={14} className="diff-arrow" />}
                            {change.newValue && (
                              <div className="diff-val diff-val--new">
                                <small>Стало</small>
                                <span>{change.newValue}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
