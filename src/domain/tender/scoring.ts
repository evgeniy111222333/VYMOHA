import type { BuyerContext, CompanyProfile, NormalizedTender, ScoreFactor, Verdict } from "./types";

export type ScoreBreakdown = { score: number; confidence: number; verdict: Verdict; factors: ScoreFactor[] };

const ACTIVE_STATUSES = new Set([
  "active.tendering",
  "active.pre-qualification",
  "active.pre-qualification.stand-still",
  "active.auction",
  "active.qualification",
  "active.awarded",
]);

export function scoreTender(
  tender: NormalizedTender,
  company?: CompanyProfile,
  now = new Date(),
  buyerContext?: BuyerContext,
): ScoreBreakdown {
  let score = 54;
  let confidence = 58;
  const factors: ScoreFactor[] = [{
    id: "baseline", label: "Базова оцінка", points: 54,
    description: "Нейтральна стартова точка для закупівлі з відкритих даних Prozorro.", kind: "base",
  }];
  const companyCpvMatch = Boolean(
    company?.cpvCodes.length
    && tender.cpvCode
    && company.cpvCodes.some((code) => tender.cpvCode?.startsWith(code.slice(0, 5))),
  );

  if (ACTIVE_STATUSES.has(tender.status)) {
    score += 14;
    factors.push({ id: "procedure-active", label: "Процедуру не скасовано", points: 14, description: `Статус Prozorro: ${tender.status}.`, kind: "positive" });
  } else {
    score -= 38;
    factors.push({ id: "procedure-inactive", label: "Процедура неактивна", points: -38, description: `Статус Prozorro: ${tender.status}.`, kind: "negative" });
  }

  const deadline = tender.deadline ? new Date(tender.deadline) : null;
  const deadlineHours = deadline && Number.isFinite(deadline.getTime()) ? (deadline.getTime() - now.getTime()) / 3_600_000 : null;
  const submissionOpen = deadlineHours !== null && deadlineHours >= 0;
  if (deadlineHours !== null) {
    if (deadlineHours < 0) {
      score -= 45;
      factors.push({ id: "deadline-closed", label: "Подання завершено", points: -45, description: "Це головна причина низької оцінки: нову пропозицію вже подати неможливо.", kind: "negative" });
    } else if (deadlineHours < 48) {
      score -= 18;
      factors.push({ id: "deadline-critical", label: "Менше 48 годин", points: -18, description: "Високий ризик не встигнути підготувати й перевірити пакет.", kind: "negative" });
    } else if (deadlineHours < 96) {
      score -= 8;
      factors.push({ id: "deadline-short", label: "Менше 4 діб", points: -8, description: "Час на уточнення та виправлення обмежений.", kind: "negative" });
    } else {
      score += 8;
      factors.push({ id: "deadline-comfortable", label: "Є час на підготовку", points: 8, description: "До завершення подання залишається понад чотири доби.", kind: "positive" });
    }
    confidence += 5;
  }

  if (tender.documents.length > 0) confidence += 10;
  if (tender.structuredCriteria.length > 0) confidence += 8;
  if (tender.guaranteeAmount) {
    score -= 4;
    factors.push({ id: "guarantee", label: "Тендерне забезпечення", points: -4, description: "Гарантія додає витрати та формальний ризик помилки.", kind: "negative" });
  } else if (submissionOpen) {
    score += 10;
    factors.push({ id: "no-guarantee", label: "Без тендерного забезпечення", points: 10, description: "У структурованих даних не заявлено банківську гарантію для пропозиції. Файли базовий режим не читає.", kind: "positive" });
  }

  if (company) {
    confidence += 10;
    if (companyCpvMatch) {
      score += 16;
      factors.push({ id: "cpv-match", label: "CPV збігається з профілем", points: 16, description: "Код закупівлі відповідає збереженому профілю компанії.", kind: "positive" });
    }
    if (company.edrpou) confidence += 3;
    const certificationPoints = Math.min(company.certifications.length * 2, 8);
    if (certificationPoints) {
      score += certificationPoints;
      factors.push({ id: "certifications", label: "Додані сертифікати", points: certificationPoints, description: "У профілі є докази, які можна зіставляти з вимогами.", kind: "positive" });
    }
  }

  if (submissionOpen && buyerContext && buyerContext.decidedAwards >= 5) {
    const rate = buyerContext.disqualificationRate;
    const percent = Math.round(rate * 100);
    if (rate >= 0.5) {
      score -= 20;
      factors.push({ id: "buyer-high-dq", label: "Замовник часто відхиляє", points: -20, description: `${percent}% рішень у вибірці завершились дискваліфікацією.`, kind: "negative" });
    } else if (rate >= 0.35) {
      score -= 12;
      factors.push({ id: "buyer-elevated-dq", label: "Підвищений рівень відхилень", points: -12, description: `${percent}% рішень у вибірці завершились дискваліфікацією.`, kind: "negative" });
    } else if (rate >= 0.2) {
      score -= 6;
      factors.push({ id: "buyer-moderate-dq", label: "Є ризик відхилення", points: -6, description: `${percent}% рішень у вибірці завершились дискваліфікацією.`, kind: "negative" });
    } else if (rate <= 0.1) {
      score += 4;
      factors.push({ id: "buyer-low-dq", label: "Низька частка відхилень", points: 4, description: `${percent}% рішень у вибірці завершились дискваліфікацією.`, kind: "positive" });
    }
  }

  const rawScore = Math.max(0, Math.min(100, Math.round(score)));
  const profileAwareScore = companyCpvMatch ? rawScore : Math.min(rawScore, 69);
  if (profileAwareScore < rawScore) {
    factors.push({
      id: "profile-cap", label: "Немає підтвердженого профілю", points: profileAwareScore - rawScore,
      description: "Без CPV і можливостей компанії базова перевірка не може дати оцінку вище 69.", kind: "limit",
    });
  }
  const canRecommend = companyCpvMatch && tender.documents.length > 0 && submissionOpen;
  const verdict: Verdict = canRecommend && profileAwareScore >= 75 ? "go" : profileAwareScore >= 45 ? "maybe" : "no-go";
  const confidenceCap = company ? 90 : 78;
  return {
    score: profileAwareScore,
    confidence: Math.max(35, Math.min(confidenceCap, Math.round(confidence))),
    verdict,
    factors,
  };
}

export type MultiVectorScoringInput = {
  requirements: Array<{ category: string; status: "met" | "missing" | "review" | "unknown" }>;
  risks: Array<{ title?: string; level: "critical" | "high" | "medium" | "low" }>;
  requiredDocumentsChecklist?: Array<{ category: string }>;
  hasCompanyProfile: boolean;
  submissionOpen: boolean;
};

export function calculateWeightedMatrixScore(input: MultiVectorScoringInput): { score: number; verdict: Verdict; factors: ScoreFactor[] } {
  const reqs = input.requirements || [];
  const statutoryReqs = reqs.filter((r) => r.category === "statutory");
  const qualReqs = reqs.filter((r) => r.category === "qualification" || r.category === "experience");
  const techReqs = reqs.filter((r) => r.category === "technical");
  const finReqs = reqs.filter((r) => r.category === "financial");

  function calcVector(arr: typeof reqs, maxPoints: number): number {
    if (arr.length === 0) return maxPoints;
    const met = arr.filter((r) => r.status === "met").length;
    const review = arr.filter((r) => r.status === "review" || r.status === "unknown").length;
    return Math.round((met * maxPoints + review * maxPoints * 0.5) / arr.length);
  }

  const vStatutory = calcVector(statutoryReqs, 25);
  const vQual = calcVector(qualReqs, 35);
  const vTech = calcVector(techReqs, 25);
  const vFin = calcVector(finReqs, 15);

  const factors: ScoreFactor[] = [];
  factors.push({ id: "ai-qual", label: "Кваліфікація та досвід", points: vQual, description: `Зіставлення з профілем компанії (до ${35} балів)`, kind: "base" });
  factors.push({ id: "ai-statutory", label: "Юридичні вимоги", points: vStatutory, description: `Статутні документи (до ${25} балів)`, kind: "base" });
  factors.push({ id: "ai-tech", label: "Технічна відповідність", points: vTech, description: `Характеристики предмета (до ${25} балів)`, kind: "base" });
  factors.push({ id: "ai-fin", label: "Фінансові умови", points: vFin, description: `Гарантії та оплата (до ${15} балів)`, kind: "base" });

  let raw = vStatutory + vQual + vTech + vFin;

  for (const [i, risk] of (input.risks || []).entries()) {
    const riskTitle = risk.title || "Знайдено ризик";
    if (risk.level === "critical") { raw -= 25; factors.push({ id: `risk-${i}`, label: riskTitle, points: -25, description: "Критичний ризик", kind: "negative" }); }
    else if (risk.level === "high") { raw -= 14; factors.push({ id: `risk-${i}`, label: riskTitle, points: -14, description: "Високий ризик", kind: "negative" }); }
    else if (risk.level === "medium") { raw -= 7; factors.push({ id: `risk-${i}`, label: riskTitle, points: -7, description: "Середній ризик", kind: "negative" }); }
    else if (risk.level === "low") { raw -= 3; factors.push({ id: `risk-${i}`, label: riskTitle, points: -3, description: "Низький ризик", kind: "negative" }); }
  }

  const hasCriticalStop = (input.risks || []).some((r) => r.level === "critical") || !input.submissionOpen;
  let score = Math.max(0, Math.min(input.hasCompanyProfile ? 100 : 69, Math.round(raw)));

  if (!input.hasCompanyProfile && score === 69 && raw > 69) {
    factors.push({ id: "profile-cap", label: "Немає підтвердженого профілю", points: 69 - raw, description: "Без профілю компанії система обмежує максимальний бал.", kind: "limit" });
  }

  if (!input.submissionOpen) {
    factors.push({ id: "closed", label: "Подання завершено", points: -score, description: "Дедлайн минув, участь неможлива.", kind: "negative" });
    score = 0;
  } else if (hasCriticalStop) {
    const deduction = score - Math.min(score, 10);
    if (deduction > 0) {
      factors.push({ id: "critical-cap", label: "Блокуючий фактор", points: -deduction, description: "Критичні ризики обмежують доцільність участі.", kind: "negative" });
    }
    score = Math.min(score, 10);
  }

  const verdict: Verdict = hasCriticalStop ? "no-go" : score >= 75 ? "go" : score >= 45 ? "maybe" : "no-go";
  return { score, verdict, factors };
}
