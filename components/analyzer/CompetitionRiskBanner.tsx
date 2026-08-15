import { AlertOctagon, AlertTriangle } from "lucide-react";
import type { CompetitionRisk } from "@/src/domain/tender/types";

export function CompetitionRiskBanner({ risk }: { risk: CompetitionRisk }) {
  if (risk.level === "low" || risk.flags.length === 0) return null;

  const isHigh = risk.level === "high";
  const variant = isHigh ? "rev-impact--critical" : "rev-impact--warning";
  const Icon = isHigh ? AlertOctagon : AlertTriangle;

  return (
    <aside className={`rev-impact-banner ${variant} competition-risk`} aria-label="Ризики для учасника">
      <Icon size={20} />
      <div>
        <b>{isHigh ? "Високий ризик для учасника" : "Ознаки ризику для учасника"}</b>
        <ul className="competition-flags">
          {risk.flags.map((flag) => (
            <li key={flag.id}>
              <strong>{flag.title}</strong>
              <span>{flag.description}</span>
            </li>
          ))}
        </ul>
        <p>Це статистичні сигнали з відкритих даних Prozorro, а не оцінка законності дій замовника.</p>
      </div>
    </aside>
  );
}
