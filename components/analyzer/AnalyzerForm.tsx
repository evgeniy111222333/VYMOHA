"use client";

import { useState } from "react";
import { ArrowRight, BrainCircuit, Coins, FileCheck2, Gauge, LoaderCircle, LockKeyhole, ScanSearch } from "lucide-react";
import { ANALYSIS_TIERS, type AnalysisTier } from "@/src/domain/billing/packages";
import { formatSignals, SIGNAL_UNIT_SHORT } from "@/src/domain/billing/presentation";
import type { TenderAnalysis } from "@/src/domain/tender/types";
import { AnalysisResult } from "./AnalysisResult";

type AnalyzerFormProps = {
  variant?: "embedded" | "page";
  defaultValue?: string;
  defaultTier?: AnalysisTier;
  allowDeepAnalysis?: boolean;
  signedIn?: boolean;
  initialCredits?: number;
  signInHref?: string;
};

const tierIcons = { quick: Gauge, deep: ScanSearch, expert: BrainCircuit };

function tierPriceLabel(credits: number): string {
  if (credits === 0) return `0 ${SIGNAL_UNIT_SHORT} · базова`;
  return formatSignals(credits, true);
}

export function AnalyzerForm({
  variant = "page", defaultValue = "", defaultTier, allowDeepAnalysis = false, signedIn = false, initialCredits = 0, signInHref = "/dashboard",
}: AnalyzerFormProps) {
  const [source, setSource] = useState(defaultValue);
  const [tier, setTier] = useState<AnalysisTier>(defaultTier ?? "quick");
  const [balance, setBalance] = useState(initialCredits);
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAnalysis(null);
    const tierConfig = ANALYSIS_TIERS[tier];
    if (tier !== "quick" && !signedIn) { window.location.href = signInHref; return; }
    if (tierConfig.credits > balance) { setError(`Потрібно ${formatSignals(tierConfig.credits)}. На балансі ${formatSignals(balance)}.`); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, analysisTier: tier }),
      });
      const payload = await response.json() as { data?: TenderAnalysis; meta?: { creditBalance?: number }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Не вдалося проаналізувати закупівлю.");
      setAnalysis(payload.data);
      if (typeof payload.meta?.creditBalance === "number") setBalance(payload.meta.creditBalance);
      window.setTimeout(() => document.querySelector("#analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сталася помилка. Спробуйте ще раз.");
    } finally { setLoading(false); }
  }

  const tierDescription = tier === "expert"
    ? "Максимальна глибина · до 8 документів"
    : tier === "deep"
      ? "Документи й таблиці · до 5 файлів"
      : "Структура закупівлі · базовий висновок";

  return (
    <div className={`analyzer ${variant === "embedded" ? "analyzer--embedded" : "analyzer--page"}`}>
      {allowDeepAnalysis && <div className="analysis-tier-grid" role="radiogroup" aria-label="Глибина аналізу">
        {(Object.keys(ANALYSIS_TIERS) as AnalysisTier[]).map((id) => {
          const config = ANALYSIS_TIERS[id]; const Icon = tierIcons[id];
          return <button type="button" role="radio" aria-checked={tier === id} disabled={loading} className={tier === id ? "analysis-tier is-active" : "analysis-tier"} key={id} onClick={() => setTier(id)}>
            <span><Icon size={18} /><b>{config.label}</b></span><p>{config.detail}</p><small>{tierPriceLabel(config.credits)}</small>
          </button>;
        })}
      </div>}
      {allowDeepAnalysis && <div className="analyzer-account-line">
        {signedIn ? <span><Coins size={14} /> Баланс <b>{formatSignals(balance, true)}</b></span> : <span><LockKeyhole size={14} /> Поглиблені рівні відкриваються після входу</span>}
        <span><FileCheck2 size={14} /> {tierDescription}</span>
      </div>}
      <form onSubmit={submit} className="analyzer__form">
        <label htmlFor={`tender-source-${variant}`}>Номер або посилання на закупівлю</label>
        <div className="analyzer__control">
          <span className="analyzer__prompt" aria-hidden="true">UA/</span>
          <input
            id={`tender-source-${variant}`} value={source} onChange={(event) => setSource(event.target.value)}
            disabled={loading}
            placeholder="UA-2026-08-01-000507-a" autoComplete="off" spellCheck={false} required minLength={10} maxLength={300}
            aria-describedby={`tender-hint-${variant}`}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={17} /> {tier === "quick" ? "Збираємо дані" : "Читаємо документацію"}</> : <>Запустити {tier === "quick" ? "перевірку" : "аналіз"} <ArrowRight size={17} /></>}
          </button>
        </div>
        <div className="analyzer__below" id={`tender-hint-${variant}`}>
          <span><FileCheck2 size={14} /> Результат містить джерела, рівень упевненості та наступні дії</span>
          {tier !== "quick" && <span><Coins size={14} /> Для цього рівня потрібно {formatSignals(ANALYSIS_TIERS[tier].credits)}</span>}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
      {analysis && <AnalysisResult
        analysis={analysis}
        signedIn={signedIn}
        initialCredits={balance}
        signInHref={signInHref}
      />}
    </div>
  );
}
