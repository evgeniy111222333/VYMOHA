"use client";

import { useEffect, useState } from "react";
import type { Verdict } from "@/src/domain/tender/types";

type ScoreGaugeProps = {
  score: number;
  verdict: Verdict;
};

const gradientConfigs: Record<Verdict, { id: string; start: string; stop: string; glow: string }> = {
  go: { id: "gauge-go", start: "#34d399", stop: "#059669", glow: "rgba(52, 211, 153, 0.35)" },
  maybe: { id: "gauge-maybe", start: "#fbbf24", stop: "#d97706", glow: "rgba(251, 191, 36, 0.35)" },
  "no-go": { id: "gauge-no-go", start: "#f87171", stop: "#dc2626", glow: "rgba(248, 113, 113, 0.35)" },
};

export function ScoreGauge({ score, verdict }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config = gradientConfigs[verdict] ?? gradientConfigs.maybe;

  const radius = 34;
  const circumference = 2 * Math.PI * radius; // ~213.63

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(Math.max(0, Math.min(100, score)));
    }, 60);
    return () => clearTimeout(timer);
  }, [score]);

  const dashOffset = circumference * (1 - animatedScore / 100);

  return (
    <div
      className={`score-gauge score-gauge--${verdict}`}
      style={{ "--glow-color": config.glow } as React.CSSProperties}
      title={`Бал привабливості: ${score} зі 100`}
    >
      <svg className="score-gauge__svg" viewBox="0 0 80 80" aria-hidden="true">
        <defs>
          <linearGradient id={config.id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.start} />
            <stop offset="100%" stopColor={config.stop} />
          </linearGradient>
        </defs>

        {/* Track circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="score-gauge__track"
          strokeWidth="6"
        />

        {/* Progress stroke */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="score-gauge__fill"
          strokeWidth="6"
          stroke={`url(#${config.id})`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
      </svg>

      <div className="score-gauge__text">
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}
