"use client";

import { useState } from "react";
import { CheckSquare, ExternalLink, FileCheck, FileText, Info, Layers, Quote, Search, ShieldCheck, Square } from "lucide-react";
import type { RequiredDocumentCategory, RequiredDocumentItem } from "@/src/domain/tender/types";

const categoryLabels: Record<RequiredDocumentCategory, { label: string; icon: typeof FileText }> = {
  statutory: { label: "Державні довідки (ст. 45)", icon: ShieldCheck },
  qualification: { label: "Кваліфікація та досвід", icon: FileCheck },
  technical: { label: "Технічна частина", icon: FileText },
  financial: { label: "Фінанси та забезпечення", icon: Layers },
  other: { label: "Інші документи", icon: FileText },
};

export function RequiredDocumentsChecklist({ items }: { items: RequiredDocumentItem[] }) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("all");

  if (!items || items.length === 0) return null;

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const completedCount = checkedIds.size;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const categoriesPresent = Array.from(new Set(items.map((i) => i.category)));

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  return (
    <section className="required-checklist-panel">
      <div className="required-checklist__head">
        <div className="required-checklist__title-group">
          <span className="section-kicker"><CheckSquare size={14} /> Конструктор пакета документів</span>
          <h3>Чек-лист подання пропозиції ({totalCount} пунктів)</h3>
          <p className="required-checklist__subtitle">Кожен пункт підтверджено цитатою з тендерної документації або законодавства</p>
        </div>
        <div className="required-checklist__progress">
          <div className="required-checklist__progress-text">
            <b>{completedCount} з {totalCount} підготовлено</b>
            <span>{progressPercent}%</span>
          </div>
          <div className="required-checklist__progress-bar">
            <div className="required-checklist__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="required-checklist__tabs">
        <button
          type="button"
          className={`required-checklist__tab ${activeCategory === "all" ? "is-active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          Всі ({totalCount})
        </button>
        {categoriesPresent.map((cat) => {
          const count = items.filter((i) => i.category === cat).length;
          const conf = categoryLabels[cat] ?? { label: cat, icon: FileText };
          return (
            <button
              key={cat}
              type="button"
              className={`required-checklist__tab ${activeCategory === cat ? "is-active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {conf.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="required-checklist__grid">
        {filteredItems.map((item) => {
          const isDone = checkedIds.has(item.id);
          const catInfo = categoryLabels[item.category] ?? { label: item.category, icon: FileText };
          const Icon = catInfo.icon;

          return (
            <article
              key={item.id}
              className={`required-checklist-card ${isDone ? "is-done" : ""}`}
            >
              <div className="required-checklist-card__header">
                <div
                  className="required-checklist-card__check-toggle"
                  onClick={() => toggleCheck(item.id)}
                  role="checkbox"
                  aria-checked={isDone}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggleCheck(item.id);
                    }
                  }}
                >
                  {isDone ? <CheckSquare size={20} className="icon-done" /> : <Square size={20} className="icon-pending" />}
                </div>

                <div className="required-checklist-card__meta">
                  <span className="required-checklist-card__cat">
                    <Icon size={12} /> {catInfo.label}
                  </span>
                  {item.requiredType && (
                    <span className={`required-checklist-card__type required-checklist-card__type--${item.requiredType}`}>
                      {item.requiredType === "document" ? "Документ / Файл" : item.requiredType === "statement" ? "Декларативна галочка" : "Довідка або витяг"}
                    </span>
                  )}
                </div>
              </div>

              <div className="required-checklist-card__body">
                <h4 onClick={() => toggleCheck(item.id)}>{item.title}</h4>
                <p>{item.description}</p>

                {item.note && (
                  <div className="required-checklist-card__note">
                    <Info size={13} />
                    <span>{item.note}</span>
                  </div>
                )}
              </div>

              {item.evidence && (
                <div className="required-checklist-card__evidence">
                  <div className="required-checklist-card__evidence-header">
                    <span className="required-checklist-card__evidence-source">
                      <Search size={11} /> <strong>Джерело:</strong> {item.evidence.label}
                    </span>
                    {item.evidence.source && (
                      <a href={item.evidence.source} target="_blank" rel="noreferrer" title="Перейти до джерела у Prozorro">
                        Prozorro <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {item.evidence.excerpt && (
                    <div className="required-checklist-card__quote" title="Точна цитата з файлу ТД для пошуку через Ctrl+F">
                      <Quote size={12} />
                      <q>{item.evidence.excerpt}</q>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
