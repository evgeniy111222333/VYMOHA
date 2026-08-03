"use client";

import { useState } from "react";
import { Check, Clock, Info, ShieldAlert, Gavel, FileCheck, FileSignature } from "lucide-react";

type ProzorroLifecycleTimelineProps = {
  status: string;
  datePublished?: string;
  deadline?: string;
  auctionStartDate?: string;
  hasAuction?: boolean;
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

export function ProzorroLifecycleTimeline({ status, datePublished, deadline, auctionStartDate, hasAuction }: ProzorroLifecycleTimelineProps) {
  const [activeHoverStage, setActiveHoverStage] = useState<number | null>(null);

  const formattedPublished = datePublished
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(datePublished))
    : "Дата не вказана";

  const formattedDeadline = deadline
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deadline))
    : "Дата не вказана";

  const formattedAuctionDate = auctionStartDate
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(auctionStartDate))
    : null;

  const auctionTimeWindow = hasAuction === false
    ? "Без аукціону"
    : formattedAuctionDate
      ? formattedAuctionDate
      : "Після дедлайну";

  const currentStageIndex = getStageIndex(status);

  const stages: StageInfo[] = [
    {
      id: "published",
      title: "Оголошення",
      subtitle: "Публікація закупівлі",
      icon: Clock,
      timeWindow: formattedPublished,
      description: "Замовник оголосив про проведення торгів та оприлюднив тендерну документацію.",
      actionHint: "Ознайомтеся з вимогами ТД та за потреби поставте запитання замовнику до дедлайну.",
    },
    {
      id: "tendering",
      title: "Прийом заявок",
      subtitle: "Подання пропозицій",
      icon: FileCheck,
      timeWindow: `до ${formattedDeadline}`,
      description: "Період для підготовки, формування кошторисів та подачі пропозиції у систему Prozorro.",
      actionHint: "Подайте тендерну пропозицію та банківську гарантію до кінця цього строку.",
    },
    {
      id: "auction",
      title: "Аукціон",
      subtitle: hasAuction === false ? "Без аукціону" : "Онлайн-торги",
      icon: Gavel,
      timeWindow: auctionTimeWindow,
      description: hasAuction === false
        ? "Електронний редукціон не передбачено. Оцінка відбувається за початковими поданими цінами."
        : formattedAuctionDate
          ? `Онлайн-аукціон призначено Prozorro на ${formattedAuctionDate}.`
          : "Час аукціону призначається системою Prozorro протягом 24h після кінцевого дедлайну.",
      actionHint: "Отримайте посилання на аукціон у кабінеті майданчика та вчасно увійдіть на торги.",
    },
    {
      id: "qualification",
      title: "Кваліфікація",
      subtitle: "Перевірка переможця",
      icon: ShieldAlert,
      timeWindow: "5–20 днів",
      description: "Замовник розглядав документи пропозиції на відповідність усім вимогам ТД та ст. 45.",
      actionHint: "Стежте за протоколами замовника. У разі відхилення пропозиція переходить наступному.",
    },
    {
      id: "awarded",
      title: "Угоду підписано",
      subtitle: "Завершення торгів",
      icon: FileSignature,
      timeWindow: "10–20 днів",
      description: "Рішення про намір укласти договір прийнято та контракт підписано в Prozorro.",
      actionHint: "Період для оскарження торгів в АМКУ вичерпано, договір набув чинності.",
    },
  ];

  const activeIndex = activeHoverStage !== null ? activeHoverStage : currentStageIndex;
  const activeStage = stages[activeIndex]!;

  return (
    <div className="timeline-rail-card">
      <div className="timeline-rail-card__head">
        <div className="timeline-rail-card__title">
          <Clock size={15} />
          <span>Перебіг закупівлі — <b>Етап {currentStageIndex + 1} з 5</b></span>
        </div>
        <span className="timeline-rail-card__status">
          <span className="timeline-pulse-dot" />
          {stages[currentStageIndex]!.title}: {stages[currentStageIndex]!.subtitle}
        </span>
      </div>

      <div className="timeline-rail-track">
        <div
          className="timeline-rail-progress"
          style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
        />
        {stages.map((stage, idx) => {
          const isDone = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isSelected = idx === activeIndex;

          return (
            <button
              key={stage.id}
              type="button"
              className={`timeline-rail-node ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""} ${isSelected ? "is-selected" : ""}`}
              onClick={() => setActiveHoverStage(idx)}
            >
              <div className="timeline-rail-node__circle">
                {isDone ? <Check size={12} /> : <span>{idx + 1}</span>}
              </div>
              <span className="timeline-rail-node__label">{stage.title}</span>
              <small className="timeline-rail-node__time">{stage.timeWindow}</small>
            </button>
          );
        })}
      </div>

      {activeStage && (
        <div className="timeline-rail-detail">
          <div className="timeline-rail-detail__header">
            <activeStage.icon size={15} />
            <b>{activeIndex + 1}. {activeStage.title}</b>
            <span className="timeline-rail-detail__badge">{activeStage.subtitle}</span>
          </div>
          <p className="timeline-rail-detail__text">{activeStage.description}</p>
          <div className="timeline-rail-detail__hint">
            <Info size={13} />
            <span><b>Дія для постачальника:</b> {activeStage.actionHint}</span>
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
