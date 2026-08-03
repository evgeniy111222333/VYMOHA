"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Info, HelpCircle, ShieldAlert, Gavel, FileCheck, FileSignature } from "lucide-react";

type ProzorroLifecycleTimelineProps = {
  status: string;
  datePublished?: string;
  deadline?: string;
};

type StageInfo = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Clock;
  description: string;
  actionHint: string;
  timeWindow: string;
};

export function ProzorroLifecycleTimeline({ status, datePublished, deadline }: ProzorroLifecycleTimelineProps) {
  const [activeHoverStage, setActiveHoverStage] = useState<number | null>(null);

  const formattedPublished = datePublished
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(datePublished))
    : "Дата не вказана";

  const formattedDeadline = deadline
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deadline))
    : "Дата не вказана";

  const currentStageIndex = getStageIndex(status);

  const stages: StageInfo[] = [
    {
      id: "published",
      title: "1. Оголошення",
      subtitle: "Публікація в Prozorro",
      icon: Clock,
      timeWindow: formattedPublished,
      description: "Замовник оголосив про початок проведення закупівлі та завантажив первинну тендерну документацію.",
      actionHint: "Час первинного ознайомлення з вимогами ТД та формування списку запитань замовнику.",
    },
    {
      id: "tendering",
      title: "2. Прийом пропозицій",
      subtitle: "Подання заявок",
      icon: FileCheck,
      timeWindow: `до ${formattedDeadline}`,
      description: "Період, коли учасники завантажують свої тендерні пропозиції, кошториси та довідки у систему Prozorro.",
      actionHint: "Обов’язково подайте пропозицію та банківську гарантію до кінця цього строку. Після дедлайну подача заблокована.",
    },
    {
      id: "auction",
      title: "3. Аукціон",
      subtitle: "Онлайн-торги",
      icon: Gavel,
      timeWindow: "Після завершення прийому",
      description: "3-раундовий електронний редукціон. Учасники по черзі знижують свої цінові пропозиції.",
      actionHint: "У 1-му раунді першим ходить той, хто надав найвищу початкову ціну. Останнім ходить той, у кого початкова ціна найнижча.",
    },
    {
      id: "qualification",
      title: "4. Кваліфікація",
      subtitle: "Розгляд документів",
      icon: ShieldAlert,
      timeWindow: "5–20 робочих днів",
      description: "Замовник перевіряє тендерну пропозицію переможця аукціону на відповідність усім вимогам ТД та ст. 45.",
      actionHint: "Стежте за протоколами замовника. У разі дискваліфікації переможця черга переходить до наступного учасника.",
    },
    {
      id: "awarded",
      title: "5. Угоду підписано",
      subtitle: "Контракт та завершення",
      icon: FileSignature,
      timeWindow: "Протягом 10–20 днів",
      description: "Прийняття рішення про намір укласти договір та безпосереднє підписання контракту в Prozorro.",
      actionHint: "Період оскарження рішень у АМКУ (подання скарг) триває до підписання остаточного договору.",
    },
  ];

  const displayedStage = activeHoverStage !== null ? stages[activeHoverStage]! : stages[currentStageIndex]!;

  return (
    <div className="prozorro-timeline-card">
      <div className="prozorro-timeline-card__header">
        <div>
          <span className="prozorro-timeline-card__kicker">Життєвий цикл закупівлі</span>
          <h3>Інтерактивна хронологія Prozorro</h3>
        </div>
        <div className="prozorro-timeline-card__current-tag">
          <span className="pulsing-dot" />
          Поточний етап: <b>{stages[currentStageIndex]!.subtitle}</b>
        </div>
      </div>

      <div className="prozorro-timeline-stepper">
        {stages.map((stage, idx) => {
          const isDone = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isHovered = activeHoverStage === idx;

          let stateClass = "is-future";
          if (isDone) stateClass = "is-done";
          if (isCurrent) stateClass = "is-current";

          return (
            <div
              key={stage.id}
              className={`timeline-step ${stateClass} ${isHovered ? "is-hovered" : ""}`}
              onMouseEnter={() => setActiveHoverStage(idx)}
              onMouseLeave={() => setActiveHoverStage(null)}
              onClick={() => setActiveHoverStage(idx)}
            >
              <div className="timeline-step__node">
                {isDone ? <CheckCircle2 size={16} /> : <span>0{idx + 1}</span>}
              </div>
              <span className="timeline-step__label">{stage.title}</span>
              <small className="timeline-step__time">{stage.timeWindow}</small>
            </div>
          );
        })}
      </div>

      {displayedStage && (
        <div className="prozorro-timeline-detail">
          <div className="prozorro-timeline-detail__head">
            <div className="prozorro-timeline-detail__title">
              <displayedStage.icon size={18} />
              <h4>{displayedStage.title}: <span>{displayedStage.subtitle}</span></h4>
            </div>
            <span className="prozorro-timeline-detail__time">{displayedStage.timeWindow}</span>
          </div>

          <p className="prozorro-timeline-detail__desc">{displayedStage.description}</p>

          <div className="prozorro-timeline-detail__action">
            <Info size={16} />
            <div>
              <b>Що потрібно робити постачальнику:</b>
              <p>{displayedStage.actionHint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStageIndex(status: string): number {
  switch (status) {
    case "active.tendering":
    case "active.pre-qualification":
      return 1;
    case "active.auction":
      return 2;
    case "active.qualification":
    case "active.pre-qualification.stand-still":
      return 3;
    case "active.awarded":
    case "complete":
      return 4;
    default:
      return 1;
  }
}
