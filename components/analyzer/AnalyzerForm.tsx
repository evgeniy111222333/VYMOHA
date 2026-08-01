"use client";

import { useState } from "react";
import { ArrowRight, BrainCircuit, Coins, Gauge, LoaderCircle, LockKeyhole, ScanSearch, Sparkles } from "lucide-react";
import { ANALYSIS_TIERS, type AnalysisTier } from "@/src/domain/billing/packages";
import type { TenderAnalysis } from "@/src/domain/tender/types";
import { AnalysisResult } from "./AnalysisResult";

type AnalyzerFormProps = {
  variant?: "embedded" | "page";
  defaultValue?: string;
  allowDeepAnalysis?: boolean;
  signedIn?: boolean;
  initialCredits?: number;
  signInHref?: string;
};

const tierIcons = { quick: Gauge, deep: ScanSearch, expert: BrainCircuit };

export function AnalyzerForm({
  variant = "page", defaultValue = "", allowDeepAnalysis = false, signedIn = false, initialCredits = 0, signInHref = "/dashboard",
}: AnalyzerFormProps) {
  const [source, setSource] = useState(defaultValue);
  const [tier, setTier] = useState<AnalysisTier>("quick");
  const [balance, setBalance] = useState(initialCredits);
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAnalysis(null);
    const tierConfig = ANALYSIS_TIERS[tier];
    if (tier !== "quick" && !signedIn) { window.location.href = signInHref; return; }
    if (tierConfig.credits > balance) { setError(`Потрібно ${tierConfig.credits} кредитів. На балансі ${balance}.`); return; }
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

  return (
    <div className={`analyzer ${variant === "embedded" ? "analyzer--embedded" : "analyzer--page"}`}>
      {allowDeepAnalysis && <div className="analysis-tier-grid" role="radiogroup" aria-label="Глибина аналізу">
        {(Object.keys(ANALYSIS_TIERS) as AnalysisTier[]).map((id) => {
          const config = ANALYSIS_TIERS[id]; const Icon = tierIcons[id];
          return <button type="button" role="radio" aria-checked={tier === id} className={tier === id ? "analysis-tier is-active" : "analysis-tier"} key={id} onClick={() => setTier(id)}>
            <span><Icon size={18} /><b>{config.label}</b></span><p>{config.detail}</p><small>{config.credits ? `${config.credits} cr` : "безплатно"}</small>
          </button>;
        })}
      </div>}
      {allowDeepAnalysis && <div className="analyzer-account-line">
        {signedIn ? <span><Coins size={14} /> Баланс <b>{balance} cr</b></span> : <span><LockKeyhole size={14} /> AI-рівні відкриваються після входу</span>}
        <span><Sparkles size={14} /> {tier === "expert" ? "GPT-5.6 Sol · high reasoning" : tier === "deep" ? "GPT-5.6 Terra · PDF" : "Prozorro structured data"}</span>
      </div>}
      <form onSubmit={submit} className="analyzer__form">
        <label htmlFor={`tender-source-${variant}`}>Номер або посилання на закупівлю</label>
        <div className="analyzer__control">
          <span className="analyzer__prompt" aria-hidden="true">UA/</span>
          <input
            id={`tender-source-${variant}`} value={source} onChange={(event) => setSource(event.target.value)}
            placeholder="UA-2026-08-01-000507-a" autoComplete="off" spellCheck={false} required minLength={10} maxLength={300}
            aria-describedby={`tender-hint-${variant}`}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={17} /> {tier === "quick" ? "Збираємо дані" : "AI читає файли"}</> : <>Запустити {tier === "quick" ? "перевірку" : "аналіз"} <ArrowRight size={17} /></>}
          </button>
        </div>
        <div className="analyzer__below" id={`tender-hint-${variant}`}>
          <span><LockKeyhole size={14} /> Секретні ключі та списання виконуються тільки на сервері</span>
          {tier !== "quick" && <span><Coins size={14} /> Списання: {ANALYSIS_TIERS[tier].credits} cr; автоматичне повернення при помилці</span>}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
      {analysis && <AnalysisResult analysis={analysis} />}
    </div>
  );
}
