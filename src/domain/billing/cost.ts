const MODEL_PRICES_MICRO_USD_PER_TOKEN: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-5.6-sol": { input: 5, cached: 0.5, output: 30 },
  "gpt-5.6": { input: 5, cached: 0.5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, cached: 0.25, output: 15 },
  "gpt-5.6-luna": { input: 1, cached: 0.1, output: 6 },
  // Gemini — орієнтовні публічні ціни Google AI Studio (мікро-USD per token).
  "gemini-2.5-pro": { input: 1.25, cached: 0.31, output: 10 },
  "gemini-2.5-flash": { input: 0.3, cached: 0.075, output: 2.5 },
  "gemini-2.0-flash": { input: 0.1, cached: 0.025, output: 0.4 },
  "gemini-1.5-pro": { input: 1.25, cached: 0.31, output: 5 },
  "gemini-1.5-flash": { input: 0.075, cached: 0.018, output: 0.3 },
  "gemini-3.5-flash": { input: 0.3, cached: 0.075, output: 2.5 },
  "gemini-3.5-pro": { input: 1.25, cached: 0.31, output: 10 },
};

const FALLBACK_PRICE = { input: 1, cached: 0.1, output: 6 };

export function estimateOpenAICostMicrousd(input: {
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}): number {
  const price = MODEL_PRICES_MICRO_USD_PER_TOKEN[input.model] ?? FALLBACK_PRICE;
  const cached = Math.max(0, Math.min(input.inputTokens, input.cachedInputTokens ?? 0));
  const uncached = Math.max(0, input.inputTokens - cached);
  return Math.round(uncached * price.input + cached * price.cached + Math.max(0, input.outputTokens) * price.output);
}
