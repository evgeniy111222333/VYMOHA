import type { ContractRiskItem, PricePosition, RequiredDocumentItem, TenderRequirement, TenderRisk, Verdict } from "@/src/domain/tender/types";

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
  requiredDocumentsChecklist?: RequiredDocumentItem[];
};

export type ContractScanPayload = {
  contractRiskMatrix: ContractRiskItem[];
  priceAnalysis: PricePosition[];
};

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "source", "excerpt", "evidenceType"],
  properties: {
    label: { type: "string" },
    source: { type: "string" },
    excerpt: { type: "string" },
    evidenceType: { type: "string", enum: ["direct_quote", "business_inference", "assumption"] },
  },
};

const requiredDocumentItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "category", "title", "description", "note", "requiredType", "evidence"],
  properties: {
    id: { type: "string" },
    category: { type: "string", enum: ["statutory", "qualification", "technical", "financial", "other"] },
    title: { type: "string" },
    description: { type: "string" },
    note: { type: "string" },
    requiredType: { type: "string", enum: ["document", "statement", "either"] },
    evidence: evidenceSchema,
  },
};

export const TENDER_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "score", "confidence", "verdict", "requirements", "risks", "nextActions", "questionsToBuyer", "documentCoverage", "requiredDocumentsChecklist"],
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
        required: ["id", "title", "description", "category", "status", "matchType", "evidence"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          category: { type: "string", enum: ["deadline", "financial", "legal", "technical", "experience", "document"] },
          status: { type: "string", enum: ["met", "missing", "review", "unknown"] },
          matchType: { type: "string", enum: ["exact_table_match", "general_clause", "not_applicable"] },
          evidence: evidenceSchema,
        },
      },
    },
    risks: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "description", "level", "isStopFactor", "mitigation", "evidence"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          level: { type: "string", enum: ["critical", "high", "medium", "low"] },
          isStopFactor: {
            type: "boolean",
            description: "true лише якщо участь юридично неможлива або фінансово руйнівна (дедлайн минув, вимога без альтернатив). Штрафні санкції договору — максимум high, тобто false.",
          },
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
    requiredDocumentsChecklist: {
      type: "array",
      maxItems: 24,
      items: requiredDocumentItemSchema,
    },
  },
} as const;

/**
 * Схема другого проходу expert-режиму — глибокий скан договору та специфікації.
 * Продукує вичерпну матрицю ризиків договору по пунктах та аналіз цін по позиціях.
 */
export const CONTRACT_SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["contractRiskMatrix", "priceAnalysis"],
  properties: {
    contractRiskMatrix: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "category", "title", "description", "severity", "evidence"],
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: ["fine", "penalty", "force_majeure", "termination", "payment", "guarantee", "other"] },
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          evidence: evidenceSchema,
        },
      },
    },
    priceAnalysis: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "position", "note", "evidence"],
        properties: {
          id: { type: "string" },
          position: { type: "string" },
          quantity: { type: "string" },
          unitPrice: { type: "string" },
          totalPrice: { type: "string" },
          note: { type: "string" },
          evidence: evidenceSchema,
        },
      },
    },
  },
} as const;
