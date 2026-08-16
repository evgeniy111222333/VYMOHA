"use client";

import { useEffect, useState } from "react";
import { 
  AlertOctagon, 
  AlertTriangle, 
  Calendar, 
  CalendarClock, 
  Check, 
  CheckCircle2, 
  Coins, 
  Copy, 
  FileText, 
  Layers, 
  RotateCcw, 
  Share2, 
  ShieldCheck, 
  Sparkles, 
  TrendingDown, 
  Wand2, 
} from "lucide-react";
import { ProzorroLifecycleTimeline } from "@/components/analyzer/ProzorroLifecycleTimeline";
import type { ScoreFactor, TenderAnalysis, Verdict } from "@/src/domain/tender/types";

interface PublicTenderHeroProps {
  analysis: TenderAnalysis;
  amountFormatted: string;
  simulatedScore: number;
  simulatedVerdict: Verdict;
  simulatedFactors: ScoreFactor[];
  isExpired: boolean;
}

const TERMINAL_STATUSES = new Set(["complete", "cancelled", "unsuccessful"]);

const KIND_STATUS: Record<ScoreFactor["kind"], "ok" | "warning" | "critical" | "neutral"> = {
  base: "neutral",
  positive: "ok",
  negative: "warning",
  limit: "neutral",
};

const KIND_LABEL: Record<ScoreFactor["kind"], string> = {
  base: "Старт",
  positive: "Перевага",
  negative: "Ризик",
  limit: "Обмеження",
};

const VERDICT_META: Record<Verdict, {
  accent: string;
  glow: string;
  bgGradient: string;
  badgeClass: string;
  icon: typeof CheckCircle2;
  label: string;
  subLabel: string;
}> = {
  go: {
    accent: "#a8ff2a",
    glow: "rgba(168, 255, 42, 0.3)",
    bgGradient: "radial-gradient(circle at top left, rgba(168, 255, 42, 0.16) 0%, rgba(13, 17, 13, 0.98) 72%)",
    badgeClass: "cockpit-badge--go",
    icon: CheckCircle2,
    label: "Можна заходити",
    subLabel: "Високі шанси на перемогу",
  },
  maybe: {
    accent: "#ffb800",
    glow: "rgba(255, 184, 0, 0.3)",
    bgGradient: "radial-gradient(circle at top left, rgba(255, 184, 0, 0.16) 0%, rgba(20, 16, 10, 0.98) 72%)",
    badgeClass: "cockpit-badge--maybe",
    icon: AlertTriangle,
    label: "Потрібна перевірка",
    subLabel: "Виявлено комерційні або кваліфікаційні ризики",
  },
  "no-go": {
    accent: "#ff4d4f",
    glow: "rgba(255, 77, 79, 0.32)",
    bgGradient: "radial-gradient(circle at top left, rgba(255, 77, 79, 0.18) 0%, rgba(22, 11, 13, 0.98) 72%)",
    badgeClass: "cockpit-badge--no-go",
    icon: AlertOctagon,
    label: "Не заходити",
    subLabel: "Критичні стоп-фактори для подачі",
  },
};

export function PublicTenderHero({ analysis, amountFormatted, simulatedScore, simulatedVerdict, simulatedFactors, isExpired }: PublicTenderHeroProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [simulatedActive, setSimulatedActive] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const tender = analysis.tender;
  const baseScore = Math.max(0, Math.min(100, Math.round(analysis.score)));

  const activeScore = simulatedActive ? simulatedScore : baseScore;
  const activeVerdict: Verdict = simulatedActive ? simulatedVerdict : analysis.verdict;
  const activeFactors = simulatedActive ? simulatedFactors : analysis.scoreFactors;

  const deadlineDate = tender.deadline ? new Date(tender.deadline) : null;
  const isClosed = isExpired || TERMINAL_STATUSES.has(tender.status);
  const deadlineFormatted = deadlineDate
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(deadlineDate)
    : "не вказано";

  const datePublishedFormatted = tender.datePublished
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(new Date(tender.datePublished))
    : "—";

  const docCount = tender.documents.filter((doc) => doc.title.toLowerCase() !== "sign.p7s").length;

  const minStepFormatted = tender.minimalStepAmount
    ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: tender.currency ?? "UAH", maximumFractionDigits: 0 }).format(tender.minimalStepAmount)
    : "—";

  const minStepPercent = tender.amount && tender.minimalStepAmount
    ? `(${((tender.minimalStepAmount / tender.amount) * 100).toFixed(1)}%)`
    : "";

  // Smooth CountUp Animation on change
  useEffect(() => {
    const start = 0;
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(start + (activeScore - start) * easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [activeScore]);

  const handleCopyId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tender.externalId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Precision Chronograph Math
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const meta = VERDICT_META[activeVerdict];
  const VerdictIcon = meta.icon;
  const verdictLabel = simulatedActive ? `Симуляція: ${meta.label}` : meta.label;
  const verdictSub = simulatedActive ? "Потенціал закупівлі без урахування дедлайну" : meta.subLabel;

  return (
    <div className="cockpit-container">
      {/* 1. Main High-Tech Diagnostic Cockpit */}
      <section className="cockpit-card" style={{ boxShadow: `0 20px 50px rgba(0,0,0,0.35), 0 0 35px ${meta.glow}` }}>
        {/* Top Intelligence Bar */}
        <header className="cockpit-topbar">
          <div className="cockpit-topbar__left">
            <button 
              type="button" 
              className="cockpit-id-badge" 
              onClick={handleCopyId}
              title="Скопіювати ID закупівлі"
            >
              <span className="mono">{tender.externalId}</span>
              {copiedId ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {copiedId && <span className="cockpit-toast">ID Скопійовано!</span>}
            </button>
            <span className="cockpit-topbar__divider">/</span>
            <span className="cockpit-topbar__buyer truncate">{tender.buyer}</span>
          </div>

          <div className="cockpit-topbar__right">
            <button 
              type="button" 
              className="cockpit-action-btn"
              onClick={handleShare}
              title="Поділитися посиланням"
            >
              <Share2 size={13} />
              <span>{copiedLink ? "Посилання скопійовано" : "Поділитися"}</span>
            </button>

            <span className={`cockpit-status-tag ${isClosed ? "is-expired" : "is-live"}`}>
              <span className="cockpit-status-pulse" />
              {isClosed ? "Процедура закрита" : "Прийом заявок триває"}
            </span>
          </div>
        </header>

        {/* 3-Column Diagnostic Surface */}
        <div className="cockpit-surface">
          {/* Column 1: Radar Precision Gauge with Interactive Sweep */}
          <div className="cockpit-gauge-col" style={{ background: meta.bgGradient }}>
            <div className="cockpit-gauge-wrapper">
              {/* Radar Sweep Effect */}
              <div className="cockpit-radar-sweep" />

              <svg className="cockpit-gauge-svg" viewBox="0 0 106 106">
                {/* Graduated Tick Ring */}
                <circle
                  className="cockpit-gauge-bg"
                  cx="53"
                  cy="53"
                  r={radius}
                  strokeWidth="7"
                />
                {/* Animated Progress Arc */}
                <circle
                  className="cockpit-gauge-progress"
                  cx="53"
                  cy="53"
                  r={radius}
                  strokeWidth="7"
                  stroke={meta.accent}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 53 53)"
                />
              </svg>

              <div className="cockpit-gauge-center">
                <span className="cockpit-score-digit">{displayScore}</span>
                <span className="cockpit-score-max">/100</span>
              </div>
            </div>

            <div className={`cockpit-verdict-pill ${meta.badgeClass}`}>
              <VerdictIcon size={13} />
              <span>{verdictLabel}</span>
            </div>

            <span className="cockpit-verdict-sub">{verdictSub}</span>

            {/* Interactive What-If Simulation Toggle for Closed Tenders */}
            {isClosed && (
              <button
                type="button"
                className={`cockpit-sim-btn ${simulatedActive ? "is-simulating" : ""}`}
                onClick={() => setSimulatedActive(!simulatedActive)}
                title="Переглянути бал без штрафу за завершений дедлайн"
              >
                {simulatedActive ? <RotateCcw size={12} /> : <Wand2 size={12} />}
                <span>{simulatedActive ? "Скинути симуляцію" : "Симулювати відкритий"}</span>
              </button>
            )}
          </div>

          {/* Column 2: Diagnostic Factors & AI Reasoning */}
          <div className="cockpit-intelligence-col">
            <div className="cockpit-intelligence-head">
              <div className="cockpit-intelligence-kicker">
                <Sparkles size={13} />
                <span>Діагностика готовності до участі</span>
              </div>
              <span className="cockpit-confidence-badge">
                Надійність моделі: <b>{analysis.confidence}%</b>
              </span>
            </div>

            <p className="cockpit-intelligence-summary">
              {simulatedActive
                ? `⚡ Симуляція: якби цей тендер був відкритий зараз, бал за моделлю склав би ${simulatedScore}/100 — ${meta.label.toLowerCase()}.`
                : analysis.summary.replace(/ ?Повний аналіз доступний у платних рівнях — кнопка нижче\./g, "")}
            </p>

            {/* Real Score Factors Matrix */}
            <div className="cockpit-factors-grid">
              {activeFactors.map((factor) => (
                <div
                  key={factor.id}
                  className={`cockpit-factor-card cockpit-factor-card--${KIND_STATUS[factor.kind]}`}
                >
                  <div className="cockpit-factor-card__head">
                    <div className="cockpit-factor-card__left">
                      <span className="cockpit-factor-card__status-dot" />
                      <span className="cockpit-factor-card__title">{factor.label}</span>
                    </div>
                    <div className="cockpit-factor-card__right">
                      <span className="cockpit-factor-card__points">{factor.points > 0 ? `+${factor.points}` : factor.points} б.</span>
                      <span className="cockpit-factor-card__badge">{KIND_LABEL[factor.kind]}</span>
                    </div>
                  </div>
                  <p>{factor.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: High-Priority Financial & Time Metrics */}
          <div className="cockpit-metrics-col">
            <div className="cockpit-metric-card">
              <div className="cockpit-metric-card__header">
                <Coins size={13} />
                <span>Очікувана вартість</span>
              </div>
              <div className="cockpit-metric-card__value">{amountFormatted}</div>
              <div className="cockpit-metric-card__sub">з ПДВ замовника</div>
            </div>

            <div className="cockpit-metric-card">
              <div className="cockpit-metric-card__header">
                <CalendarClock size={13} />
                <span>Кінцевий дедлайн</span>
              </div>
              <div className="cockpit-metric-card__value">{deadlineFormatted}</div>
              <div className="cockpit-metric-card__sub">
                {isExpired ? "Прийом пропозицій закрито" : "Час подачі за Києвом"}
              </div>
            </div>

            <div className="cockpit-metric-card">
              <div className="cockpit-metric-card__header">
                <TrendingDown size={13} />
                <span>Крок пониження</span>
              </div>
              <div className="cockpit-metric-card__value">
                {minStepFormatted} <small className="mono">{minStepPercent}</small>
              </div>
              <div className="cockpit-metric-card__sub">Мінімальна зміна ціни</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 4-Card Tender Passport Strip */}
      <div className="tender-passport-bar">
        <div className="passport-item">
          <div className="passport-item__icon"><Calendar size={16} /></div>
          <div>
            <small>Оголошено в Prozorro</small>
            <b>{datePublishedFormatted}</b>
          </div>
        </div>

        <div className="passport-item">
          <div className="passport-item__icon"><Layers size={16} /></div>
          <div>
            <small>Класифікатор CPV</small>
            <b className="mono">{tender.cpvCode ?? "—"}</b>
          </div>
        </div>

        <div className="passport-item">
          <div className="passport-item__icon"><ShieldCheck size={16} /></div>
          <div>
            <small>Забезпечення тендеру</small>
            <b>
              {tender.guaranteeAmount
                ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: tender.guaranteeCurrency ?? "UAH", maximumFractionDigits: 0 }).format(tender.guaranteeAmount)
                : "Без застави"}
            </b>
          </div>
        </div>

        <div className="passport-item">
          <div className="passport-item__icon"><FileText size={16} /></div>
          <div>
            <small>Документація ТД</small>
            <b>{docCount === 0 ? "0 файлів" : docCount === 1 ? "1 документ" : `${docCount} файлів`}</b>
          </div>
        </div>
      </div>

      {/* 3. Interactive Prozorro Lifecycle Timeline */}
      <ProzorroLifecycleTimeline
        status={tender.status}
        datePublished={tender.datePublished}
        deadline={tender.deadline}
        auctionStartDate={tender.auctionStartDate}
        hasAuction={tender.hasAuction}
      />
    </div>
  );
}
