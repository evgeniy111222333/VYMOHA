import type { TenderAnalysis, TenderRequirement, TenderRisk } from "@/src/domain/tender/types";

type OpenAIResponse = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
type EnhancedPayload = { summary?: string; requirements?: TenderRequirement[]; risks?: TenderRisk[]; nextActions?: string[] };

export async function enhanceAnalysis(
  analysis: TenderAnalysis,
  apiKey: string | undefined,
  safetyIdentifier: string,
  model = "gpt-5.6-terra",
): Promise<TenderAnalysis> {
  if (!apiKey) return analysis;
  const files = analysis.tender.documents.filter((document) => document.url && document.format?.includes("pdf")).slice(0, 4);
  if (files.length === 0) return analysis;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, store: false, safety_identifier: safetyIdentifier,
      reasoning: { effort: "low" }, text: { verbosity: "low" }, max_output_tokens: 4_000,
      input: [{ role: "user", content: [
        { type: "input_text", text: buildPrompt(analysis) },
        ...files.map((document) => ({ type: "input_file", file_url: document.url, detail: "low" })),
      ] }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) return analysis;
  const payload = (await response.json()) as OpenAIResponse;
  const outputText = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!outputText) return analysis;

  try {
    const parsed = JSON.parse(stripCodeFence(outputText)) as EnhancedPayload;
    return {
      ...analysis,
      summary: parsed.summary?.slice(0, 700) || analysis.summary,
      requirements: validArray(parsed.requirements) ? parsed.requirements.slice(0, 24) : analysis.requirements,
      risks: validArray(parsed.risks) ? parsed.risks.slice(0, 16) : analysis.risks,
      nextActions: validArray(parsed.nextActions) ? parsed.nextActions.slice(0, 6) : analysis.nextActions,
      mode: "ai-enhanced", confidence: Math.min(98, analysis.confidence + 12),
    };
  } catch { return analysis; }
}

function buildPrompt(analysis: TenderAnalysis): string {
  return `Проаналізуй публічну тендерну документацію українською мовою. Ти допоміжний аналітик, не юрист.
Закупівля: ${analysis.tender.externalId}\nНазва: ${analysis.tender.title}\nЗамовник: ${analysis.tender.buyer}
Поверни ТІЛЬКИ валідний JSON без markdown:
{"summary":"...","requirements":[{"id":"stable-slug","title":"...","description":"...","category":"deadline|financial|legal|technical|experience|document","status":"review","evidence":{"label":"точна назва файлу і сторінка, якщо доступна","source":"${analysis.tender.sourceUrl}","excerpt":"коротка цитата"}}],"risks":[{"id":"stable-slug","title":"...","description":"...","level":"critical|high|medium|low","mitigation":"...","evidence":{"label":"файл і сторінка","source":"${analysis.tender.sourceUrl}","excerpt":"коротка цитата"}}],"nextActions":["..."]}
Правила: не вигадуй вимоги; для кожного висновку дай доказ; якщо сторінка невідома, не вигадуй номер; відділяй формальні, фінансові, технічні та досвідні вимоги; позначай неоднозначність як review.`;
}

function stripCodeFence(value: string): string { return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); }
function validArray(value: unknown): value is unknown[] { return Array.isArray(value) && value.length > 0; }
