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
