import { Calculator, ChevronDown } from "lucide-react";
import type { TenderAnalysis } from "@/src/domain/tender/types";

export function ScoreExplanation({ analysis }: { analysis: TenderAnalysis }) {
  return (
    <details className="score-explanation" open>
      <summary>
        <span><Calculator size={17} /><b>Чому {analysis.score}/100</b></span>
        <small>{analysis.mode === "structured" ? "Прозора евристика" : "Оцінка за доказами"}</small>
        <ChevronDown size={16} />
      </summary>
      <div className="score-factor-list">
        {analysis.scoreFactors.map((factor) => (
          <div className={`score-factor score-factor--${factor.kind}`} key={factor.id}>
            <span><b>{factor.label}</b><small>{factor.description}</small></span>
            <strong>{factor.points > 0 ? "+" : ""}{factor.points}</strong>
          </div>
        ))}
      </div>
      <p>Бал показує доцільність дії зараз, а не якість самої закупівлі. Для завершеного тендера дедлайн переважає інші фактори.</p>
    </details>
  );
}
