import type { CompetitionRisk, CompetitionRiskLevel, RedFlagSignal } from "@/src/domain/tender/types";
import type { NormalizedTender } from "@/src/domain/tender/types";
import { isCompetitiveMethod, winnerDiscount, type MarketSample } from "./stats";

const MIN_SIGNAL_SAMPLE = 5;
const SHORT_WINDOW_DAYS = 7;
const SINGLE_BIDDER_THRESHOLD = 0.5;
const REPEAT_WINNER_THRESHOLD = 0.6;
const ZERO_DISCOUNT_THRESHOLD = 0.5;
/** Методи, що передбачають аукціон. Решта (belowThreshold/reporting/negotiation) — без торгів. */
const AUCTION_METHODS = new Set(["aboveThreshold", "aboveThresholdUA", "aboveThresholdEU"]);
/** Допуск на clock-skew і повільне завантаження документів одного батчу публікації. */
const PUBLISH_TOLERANCE_MS = 60 * 60 * 1000;
/** Назви документів, що прямо вказують на зміни до ТД. */
const CHANGE_TITLE_PATTERN = /перелік\s+змін|зміни\s+до|виправленн|нова\s+редакц|change|changes|revision|amendment/i;

/**
 * Обчислює ознаки низької конкуренції. Сигнали історії (1–3) рахуються
 * лише при достатній конкурентній вибірці аналогів; структурні (4–5) —
 * завжди. Нічого не «вгадується»: кожен сигнал — об'єктивний факт із доказом.
 */
export function computeCompetitionRisk(
  samples: MarketSample[],
  tender: NormalizedTender,
): CompetitionRisk {
  const competitive = samples.filter((sample) =>
    isCompetitiveMethod(sample.method)
    && sample.expectedAmount > 0
    && (sample.currency === null || sample.currency === "UAH"),
  );
  const source = tender.sourceUrl;
  const flags: RedFlagSignal[] = [];
  const n = competitive.length;

  if (n >= MIN_SIGNAL_SAMPLE) {
    const singleBidderCount = competitive.filter((sample) => sample.participants <= 1).length;
    const singleBidderRate = singleBidderCount / n;
    if (singleBidderRate >= SINGLE_BIDDER_THRESHOLD) {
      flags.push({
        id: "single-bidder-history",
        title: "Зазвичай лише 1 учасник",
        severity: "warning",
        description: `У ${Math.round(singleBidderRate * 100)}% з ${n} аналогічних закупівель було не більше однієї пропозиції.`,
        evidence: { label: "Історія аналогів", source },
      });
    }

    const winnerCounts = new Map<string, number>();
    for (const sample of competitive) {
      if (!sample.winnerEdrpou) continue;
      winnerCounts.set(sample.winnerEdrpou, (winnerCounts.get(sample.winnerEdrpou) ?? 0) + 1);
    }
    const withWinner = [...winnerCounts.values()].reduce((sum, count) => sum + count, 0);
    const top = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && withWinner > 0 && top[1] / withWinner >= REPEAT_WINNER_THRESHOLD) {
      flags.push({
        id: "repeat-winner",
        title: "Один переможець домінує",
        severity: "warning",
        description: `ЄДРПОУ ${top[0]} виграв ${top[1]} з ${withWinner} аналогічних закупівель (${Math.round((top[1] / withWinner) * 100)}%).`,
        evidence: { label: "Переможці аналогів", source },
      });
    }

    const discounts = competitive
      .map((sample) => winnerDiscount(sample.expectedAmount, sample.winningAmount))
      .filter((value): value is number => value !== null);
    const zeroDiscountCount = discounts.filter((value) => value <= 0.005).length;
    if (discounts.length > 0 && zeroDiscountCount / discounts.length >= ZERO_DISCOUNT_THRESHOLD) {
      flags.push({
        id: "zero-discount-history",
        title: "Перемоги без цінової конкуренції",
        severity: "warning",
        description: `У ${Math.round((zeroDiscountCount / discounts.length) * 100)}% аналогів переможець отримав контракт майже без дисконту (виграш ≈ очікувана вартість).`,
        evidence: { label: "Дисконти аналогів", source },
      });
    }
  }

  if (tender.datePublished && tender.deadline) {
    const published = new Date(tender.datePublished);
    const deadline = new Date(tender.deadline);
    if (Number.isFinite(published.getTime()) && Number.isFinite(deadline.getTime())) {
      const days = (deadline.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0 && days < SHORT_WINDOW_DAYS) {
        flags.push({
          id: "short-bid-window",
          title: "Короткий строк на підготовку",
          severity: "info",
          description: `Від оголошення до дедлайну менш як ${SHORT_WINDOW_DAYS} діб — сторонньому учаснику важко встигнути підготувати пакет.`,
          evidence: { label: "Період подання", source, excerpt: tender.deadline },
        });
      }
    }
  }

  if (tender.method && tender.method.length > 0 && !AUCTION_METHODS.has(tender.method)) {
    flags.push({
      id: "no-auction",
      title: "Без аукціону",
      severity: "info",
      description: `Процедура без аукціону — ціна подається одноразово, без торгів.`,
      evidence: { label: "Тип процедури", source, excerpt: tender.method },
    });
  }

  const documentChanges = detectDocumentChanges(tender);
  if (documentChanges.changeListTitle || documentChanges.changedAfterPublish > 0) {
    flags.push({
      id: "document-changes",
      title: documentChanges.changeListTitle
        ? "Замовник вніс зміни до документації"
        : "Документацію оновлено після публікації",
      severity: "warning",
      description: documentChanges.changeListTitle
        ? `Виявлено документ зі списком змін («${documentChanges.changeListTitle}»); ${documentChanges.changedAfterPublish} файл(ів) оновлено після оголошення. Перевірте актуальну редакцію ТД.`
        : `${documentChanges.changedAfterPublish} файл(ів) закупівлі оновлено після оголошення — перевірте актуальну редакцію.`,
      evidence: {
        label: "Документи закупівлі",
        source,
        excerpt: documentChanges.changeListTitle ?? documentChanges.latestChange ?? undefined,
      },
    });
  }

  return { level: competitionRiskLevel(flags), flags, sampleSize: n };
}

type DocumentChangeDetection = {
  changeListTitle: string | null;
  changedAfterPublish: number;
  latestChange: string | null;
};

/**
 * Детектує зміни до ТД після публікації за документами (Prozorro не віддає
 * структурованих revisions через публічний API — замовники повідомляють про
 * зміни завантаженням нових версій документів і «Переліку змін»).
 */
function detectDocumentChanges(tender: NormalizedTender): DocumentChangeDetection {
  let changeListTitle: string | null = null;
  let changedAfterPublish = 0;
  let latestChange: string | null = null;

  const publishedMs = tender.datePublished ? new Date(tender.datePublished).getTime() : null;
  const hasPublished = publishedMs !== null && Number.isFinite(publishedMs);

  for (const doc of tender.documents) {
    if (!changeListTitle && CHANGE_TITLE_PATTERN.test(doc.title)) changeListTitle = doc.title;

    const modifiedMs = doc.dateModified ? new Date(doc.dateModified).getTime() : null;
    if (modifiedMs === null || !Number.isFinite(modifiedMs)) continue;
    if (!latestChange || modifiedMs > new Date(latestChange).getTime()) latestChange = doc.dateModified!;
    if (hasPublished && modifiedMs > publishedMs! + PUBLISH_TOLERANCE_MS) changedAfterPublish += 1;
  }

  return { changeListTitle, changedAfterPublish, latestChange };
}

export function competitionRiskLevel(flags: RedFlagSignal[]): CompetitionRiskLevel {
  const warnings = flags.filter((flag) => flag.severity === "warning").length;
  if (warnings >= 2) return "high";
  if (warnings === 1) return "medium";
  return "low";
}
