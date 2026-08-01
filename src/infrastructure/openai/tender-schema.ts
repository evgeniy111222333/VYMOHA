import type { TenderRequirement, TenderRisk, Verdict } from "@/src/domain/tender/types";

export type EnhancedTenderPayload = {
  summary: string;
  score: number;
  confidence: number;
  verdict: Verdict;
  requirements: TenderRequirement[];
  risks: TenderRisk[];
  nextActions: string[];
  questionsToBuyer: string[];
  documentCoverage: Array<{ title: string; status: "read" | "partial" | "unavailable"; notes: string }>;
};

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "source", "excerpt"],
  properties: {
    label: { type: "string" },
    source: { type: "string" },
    excerpt: { type: "string" },
  },
};

export const TENDER_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "score", "confidence", "verdict", "requirements", "risks", "nextActions", "questionsToBuyer", "documentCoverage"],
  properties: {
    summary: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string", enum: ["go", "maybe", "no-go"] },
    requirements: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "description", "category", "status", "evidence"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          category: { type: "string", enum: ["deadline", "financial", "legal", "technical", "experience", "document"] },
          status: { type: "string", enum: ["met", "missing", "review", "unknown"] },
          evidence: evidenceSchema,
        },
      },
    },
    risks: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "description", "level", "mitigation", "evidence"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          level: { type: "string", enum: ["critical", "high", "medium", "low"] },
          mitigation: { type: "string" }, evidence: evidenceSchema,
        },
      },
    },
    nextActions: { type: "array", maxItems: 8, items: { type: "string" } },
    questionsToBuyer: { type: "array", maxItems: 8, items: { type: "string" } },
    documentCoverage: {
      type: "array", maxItems: 16,
      items: {
        type: "object", additionalProperties: false, required: ["title", "status", "notes"],
        properties: {
          title: { type: "string" }, status: { type: "string", enum: ["read", "partial", "unavailable"] }, notes: { type: "string" },
        },
      },
    },
  },
} as const;
