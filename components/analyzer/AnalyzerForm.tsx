"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import type { TenderAnalysis } from "@/src/domain/tender/types";
import { AnalysisResult } from "./AnalysisResult";

type AnalyzerFormProps = { variant?: "embedded" | "page"; defaultValue?: string; allowDeepAnalysis?: boolean };

export function AnalyzerForm({ variant = "page", defaultValue = "", allowDeepAnalysis = false }: AnalyzerFormProps) {
  const [source, setSource] = useState(defaultValue);
  const [deepAnalysis, setDeepAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setAnalysis(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, deepAnalysis }),
      });
      const payload = await response.json() as { data?: TenderAnalysis; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Не вдалося проаналізувати закупівлю.");
      setAnalysis(payload.data);
      window.setTimeout(() => document.querySelector("#analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сталася помилка. Спробуйте ще раз.");
    } finally { setLoading(false); }
  }

  return (
    <div className={`analyzer ${variant === "embedded" ? "analyzer--embedded" : "analyzer--page"}`}>
      <form onSubmit={submit} className="analyzer__form">
        <label htmlFor={`tender-source-${variant}`}>Посилання або номер закупівлі</label>
        <div className="analyzer__control">
          <input
            id={`tender-source-${variant}`} value={source} onChange={(event) => setSource(event.target.value)}
            placeholder="UA-2026-08-01-000463-a" autoComplete="off" spellCheck={false} required minLength={10} maxLength={300}
            aria-describedby={`tender-hint-${variant}`}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={17} /> Аналізуємо</> : <>Перевірити <ArrowRight size={17} /></>}
          </button>
        </div>
        <div className="analyzer__below" id={`tender-hint-${variant}`}>
          <span><LockKeyhole size={14} /> Публічна перевірка без завантаження приватних файлів</span>
          {allowDeepAnalysis && <label className="deep-toggle"><input type="checkbox" checked={deepAnalysis} onChange={(event) => setDeepAnalysis(event.target.checked)} /><span /><Sparkles size={14} /> Поглиблений AI-аналіз PDF</label>}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
      {analysis && <AnalysisResult analysis={analysis} />}
    </div>
  );
}
