import type { CompanyProfile, NormalizedTender, Verdict } from "./types";

type ScoreBreakdown = { score: number; confidence: number; verdict: Verdict };

const ACTIVE_STATUSES = new Set([
  "active.tendering",
  "active.pre-qualification",
  "active.pre-qualification.stand-still",
  "active.auction",
  "active.qualification",
  "active.awarded",
]);

export function scoreTender(tender: NormalizedTender, company?: CompanyProfile, now = new Date()): ScoreBreakdown {
  let score = 54;
  let confidence = 58;
  const companyCpvMatch = Boolean(
    company?.cpvCodes.length
    && tender.cpvCode
    && company.cpvCodes.some((code) => tender.cpvCode?.startsWith(code.slice(0, 5))),
  );
  if (ACTIVE_STATUSES.has(tender.status)) score += 14;
  else score -= 38;

  const deadline = tender.deadline ? new Date(tender.deadline) : null;
  if (deadline && Number.isFinite(deadline.getTime())) {
    const hours = (deadline.getTime() - now.getTime()) / 3_600_000;
    if (hours < 0) score -= 45;
    else if (hours < 48) score -= 18;
    else if (hours < 96) score -= 8;
    else score += 8;
    confidence += 5;
  }

  if (tender.documents.length > 0) confidence += 10;
  if (tender.structuredCriteria.length > 0) confidence += 8;
  if (tender.guaranteeAmount) score -= 4;

  if (company) {
    confidence += 10;
    if (companyCpvMatch) score += 16;
    if (company.edrpou) confidence += 3;
    score += Math.min(company.certifications.length * 2, 8);
  }

  // A generic active tender is not a "go" until it is matched against the supplier.
  // The cap keeps anonymous structured checks useful without creating false confidence.
  const profileAwareScore = companyCpvMatch ? score : Math.min(score, 69);
  const boundedScore = Math.max(0, Math.min(100, Math.round(profileAwareScore)));
  const canRecommend = companyCpvMatch && tender.documents.length > 0;
  const verdict: Verdict = canRecommend && boundedScore >= 75 ? "go" : boundedScore >= 45 ? "maybe" : "no-go";
  const confidenceCap = company ? 90 : 78;
  return { score: boundedScore, confidence: Math.max(35, Math.min(confidenceCap, Math.round(confidence))), verdict };
}
