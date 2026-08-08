import { AlertTriangle, CheckCircle2, FileText, Timer } from "lucide-react";
import type { AnalysisTelemetry } from "@/src/infrastructure/storage/repository";

export function AdminDiagnostics({ entries }: { entries: AnalysisTelemetry[] }) {
  return <section className="dashboard-card diagnostics-card">
    <div className="dashboard-card__heading">
      <div className="dashboard-card__heading-main"><span className="dashboard-card__kicker">Технічна телеметрія · 30 днів</span><h2>Стан AI-аналізів</h2></div>
      <span>{entries.length} записів</span>
    </div>
    <p className="diagnostics-card__notice">Тут немає текстів документів, prompt’ів, URL чи відповідей провайдера — лише знеособлені метрики виконання.</p>
    <div className="diagnostics-list">
      {entries.length === 0 ? <p className="diagnostics-card__empty">Ще немає запусків повного аналізу за останні 30 днів.</p> : entries.map((entry) => {
        const completed = entry.status === "completed";
        return <article className="diagnostics-row" key={entry.id}>
          <div className={`diagnostics-status ${completed ? "is-completed" : "is-failed"}`}>{completed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span>{completed ? "Успішно" : "Помилка"}</span></div>
          <div><b>{entry.provider === "gemini" ? "Google Gemini" : "OpenAI"}</b><small>{entry.model} · {entry.tier}</small></div>
          <div className="diagnostics-metric"><Timer size={14} /><span>{formatDuration(entry.durationMs)}</span></div>
          <div className="diagnostics-metric"><FileText size={14} /><span>{entry.documentsRead}/{entry.documentCount}</span></div>
          <div className="diagnostics-meta"><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</time>{entry.errorCode && <small>{entry.errorCode}</small>}</div>
        </article>;
      })}</div>
  </section>;
}

function formatDuration(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)} с` : `${value} мс`;
}
