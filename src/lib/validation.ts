import { z } from "zod";

export const analyzeRequestSchema = z.object({
  source: z.string().trim().min(10).max(300),
  deepAnalysis: z.boolean().optional().default(false),
  company: z.object({
    name: z.string().trim().max(160).optional(),
    edrpou: z.string().regex(/^\d{8,10}$/).optional(),
    cpvCodes: z.array(z.string().regex(/^\d{5,8}(?:-\d)?$/)).max(30).default([]),
    certifications: z.array(z.string().trim().min(2).max(100)).max(30).default([]),
    capabilities: z.array(z.string().trim().min(2).max(180)).max(50).default([]),
  }).optional(),
});

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  edrpou: z.string().regex(/^\d{8,10}$/).optional().or(z.literal("")),
  region: z.string().trim().max(100).optional(),
  cpvCodes: z.array(z.string().regex(/^\d{5,8}(?:-\d)?$/)).max(30),
  certifications: z.array(z.string().trim().min(2).max(100)).max(30),
  capabilities: z.array(z.string().trim().min(2).max(180)).max(50),
});

export function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ error: { message, details } }, { status });
}
