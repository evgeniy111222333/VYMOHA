import { scoreTender } from "./scoring";
import type { BuyerContext, CompanyProfile, CompetitionRisk, MarketContext, NormalizedTender, TenderAnalysis, TenderRequirement, TenderRisk } from "./types";

const formatter = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });

export type AnalysisMode = "quick" | "deep" | "expert";

export function analyzeTender(
  tender: NormalizedTender,
  company?: CompanyProfile,
  now = new Date(),
  buyerContext?: BuyerContext,
  mode: AnalysisMode = "quick",
  marketContext?: MarketContext,
  competitionRisk?: CompetitionRisk,
): TenderAnalysis {
  const score = scoreTender(tender, company, now, buyerContext, marketContext);
  const requirements = buildRequirements(tender, company, now);
  const risks = buildRisks(tender, company, now, mode);
  const missingCount = requirements.filter((item) => item.status === "missing").length;
  const reviewCount = requirements.filter((item) => item.status === "review").length;

  return {
    id: crypto.randomUUID(),
    tender,
    verdict: score.verdict,
    score: score.score,
    confidence: score.confidence,
    scoreFactors: score.factors,
    buyerContext,
    marketContext,
    competitionRisk,
    summary: buildSummary(score.verdict, missingCount + reviewCount, tender, now, mode, marketContext, competitionRisk),
    generatedAt: now.toISOString(),
    mode: "structured",
    requirements,
    risks,
    nextActions: buildNextActions(requirements, risks, mode),
    disclaimer: "Автоматичний аналіз є допоміжним інструментом і не замінює юридичну перевірку або рішення відповідальної особи.",
  };
}

function isDeadlineClosed(tender: NormalizedTender, now: Date): boolean {
  if (!tender.deadline) return false;
  const deadline = new Date(tender.deadline);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() < now.getTime();
}

function buildSummary(verdict: TenderAnalysis["verdict"], openCount: number, tender: NormalizedTender, now: Date, mode: AnalysisMode, marketContext?: MarketContext, competitionRisk?: CompetitionRisk): string {
  const suffix = mode === "quick"
    ? " Повний аналіз доступний у платних рівнях — кнопка нижче."
    : "";
  const marketSentence = buildMarketSentence(tender, marketContext);
  const competitionSentence = buildCompetitionSentence(competitionRisk);
  const base = verdict === "go"
    ? `Закупівля виглядає перспективною. Перед поданням підтвердьте ${openCount} пунктів, які потребують ручної перевірки.`
    : verdict === "maybe"
      ? `Потенціал є, але рішення залежить від ${Math.max(1, openCount)} відкритих вимог. Не формуйте пропозицію до їх перевірки.`
      : isDeadlineClosed(tender, now)
        ? "Подання пропозицій завершено — це головна причина низького балу. Відповідність вашої компанії та зміст файлів у швидкому режимі не оцінювались."
        : "Виявлено стоп-фактори. Спершу усуньте критичні розбіжності та перевірте файли закупівлі.";
  return `${base}${suffix}${marketSentence}${competitionSentence}`;
}

export function buildMarketSentence(tender: NormalizedTender, marketContext?: MarketContext): string {
  if (!marketContext || marketContext.medianDiscount === null || !tender.amount) return "";
  const discountPercent = Math.round(marketContext.medianDiscount * 100);
  const price = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(tender.amount * (1 - marketContext.medianDiscount)));
  const scope = marketContext.scope === "buyer" ? "цього замовника" : `ринку за CPV ${marketContext.cpvClass}`;
  return ` Ринковий орієнтир: на основі ${marketContext.sampleSize} аналогічних закупівель ${scope} медіанний дисконт −${discountPercent}%, цільова ціна ≈ ${price} ${tender.currency ?? "UAH"}.`;
}

export function buildCompetitionSentence(competitionRisk?: CompetitionRisk): string {
  if (!competitionRisk || competitionRisk.level === "low") return "";
  const labels = competitionRisk.flags
    .filter((flag) => flag.severity === "warning")
    .slice(0, 3)
    .map((flag) => flag.title)
    .join(", ");
  if (!labels) return "";
  return competitionRisk.level === "high"
    ? ` Ознаки ризику для учасника: ${labels}.`
    : ` Помірні ознаки ризику для учасника: ${labels}.`;
}

function buildRequirements(tender: NormalizedTender, company: CompanyProfile | undefined, now: Date): TenderRequirement[] {
  const source = tender.sourceUrl;
  const requirements: TenderRequirement[] = [];
  const deadline = tender.deadline ? new Date(tender.deadline) : null;
  const deadlineOpen = Boolean(deadline && deadline.getTime() > now.getTime());

  requirements.push({
    id: "deadline",
    title: "Строк подання пропозиції",
    description: tender.deadline
      ? `Подати до ${new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(deadline!)}`
      : "Строк не знайдено у структурованих даних",
    category: "deadline",
    status: deadlineOpen ? "met" : "missing",
    evidence: { label: "Період подання", source, excerpt: tender.deadline },
  });

  if (tender.guaranteeAmount) {
    requirements.push({
      id: "guarantee",
      title: "Забезпечення тендерної пропозиції",
      description: `${formatter.format(tender.guaranteeAmount)} ${tender.guaranteeCurrency ?? tender.currency ?? "UAH"}`,
      category: "financial",
      status: "review",
      evidence: { label: "Guarantee", source },
    });
  }

  if (tender.enquiryDeadline) {
    const enquiryDate = new Date(tender.enquiryDeadline);
    const enquiryOpen = Number.isFinite(enquiryDate.getTime()) && enquiryDate.getTime() > now.getTime();
    requirements.push({
      id: "enquiry-deadline",
      title: "Дедлайн запитів на уточнення",
      description: `Запитати зміни документації до ${new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(enquiryDate)}`,
      category: "deadline",
      status: enquiryOpen ? "met" : "missing",
      evidence: { label: "Період уточнень", source, excerpt: tender.enquiryDeadline },
    });
  }

  if (tender.awardCriteria) {
    const criteriaLabels: Record<string, string> = {
      lowestCost: "найнижчу ціну",
      priceQuality: "співвідношення ціна/якість",
      costQuality: "співвідношення ціна/якість",
      lifeCycleCost: "вартість життєвого циклу",
      weightedOutcomes: "зважені результати",
      fixedEnactedBudget: "затверджений бюджет",
    };
    requirements.push({
      id: "award-criteria",
      title: "Критерій визначення переможця",
      description: `Переможця визначають за ${criteriaLabels[tender.awardCriteria] ?? tender.awardCriteria}`,
      category: "technical",
      status: "met",
      evidence: { label: "awardCriteria", source, excerpt: tender.awardCriteria },
    });
  }

  if (tender.clarifications?.length) {
    requirements.push({
      id: "clarifications",
      title: `Відповіді замовника на запити (${tender.clarifications.length})`,
      description: "Перегляньте опубліковані уточнення — вони можуть змінювати вимоги документації",
      category: "legal",
      status: "review",
      evidence: { label: "Запити та відповіді", source },
    });
  }

  if (tender.cpvCode) {
    const match = company?.cpvCodes.some((code) => tender.cpvCode?.startsWith(code.slice(0, 5)));
    requirements.push({
      id: "cpv-fit",
      title: `Профіль закупівлі ${tender.cpvCode}`,
      description: tender.cpvLabel ?? "Перевірте відповідність предмету вашим товарам або послугам",
      category: "technical",
      status: company ? (match ? "met" : "review") : "unknown",
      evidence: { label: "ДК 021:2015", source, excerpt: tender.cpvLabel },
    });
  }

  tender.structuredCriteria.slice(0, 8).forEach((criterion, index) => {
    requirements.push({
      id: `criterion-${index}`,
      title: criterion.title,
      description: criterion.description ?? "Потрібне документальне підтвердження",
      category: "legal",
      status: "review",
      evidence: { label: `Структурований критерій ${index + 1}`, source },
    });
  });

  const tenderDocs = tender.documents.filter((document) => document.title !== "sign.p7s");
  requirements.push({
    id: "documents",
    title: "Тендерна документація",
    description: `${formatFileCount(tenderDocs.length)} доступно для перевірки`,
    category: "document",
    status: tenderDocs.length > 0 ? "review" : "unknown",
    evidence: { label: "Документи закупівлі", source },
  });
  return requirements;
}

function buildRisks(tender: NormalizedTender, company: CompanyProfile | undefined, now: Date, mode: AnalysisMode): TenderRisk[] {
  const risks: TenderRisk[] = [];
  const deadline = tender.deadline ? new Date(tender.deadline) : null;
  if (deadline) {
    const hours = (deadline.getTime() - now.getTime()) / 3_600_000;
    if (hours < 0) {
      risks.push({
        id: "closed", title: "Подання завершено", description: "Дедлайн закупівлі вже минув.", level: "critical",
        mitigation: "Не витрачайте час на підготовку; додайте CPV-код у моніторинг майбутніх закупівель.",
        evidence: { label: "Кінцева дата", source: tender.sourceUrl, excerpt: tender.deadline },
      });
    } else if (hours < 72) {
      risks.push({
        id: "short-deadline", title: "Менше трьох діб до дедлайну",
        description: `Залишилось приблизно ${Math.max(1, Math.floor(hours))} годин.`, level: "high",
        mitigation: "Призначте відповідального та одразу перевірте гарантію, підписи й довідки.",
        evidence: { label: "Кінцева дата", source: tender.sourceUrl, excerpt: tender.deadline },
      });
    }
  }

  if (tender.guaranteeAmount) {
    risks.push({
      id: "guarantee-risk", title: "Потрібне фінансове забезпечення",
      description: "Помилка у гарантії часто є формальною підставою для відхилення.", level: "medium",
      mitigation: "Звірте текст гарантії з документацією та замовте її до фінальної перевірки пакета.",
      evidence: { label: "Забезпечення", source: tender.sourceUrl },
    });
  }

  if (tender.documents.length >= 10) {
    risks.push({
      id: "document-volume", title: "Великий пакет документів",
      description: `Опубліковано ${tender.documents.length} файлів; частина вимог може бути в додатках.`, level: "medium",
      mitigation: "Перевірте всі актуальні версії та відокремте підписані файли від застарілих.",
      evidence: { label: "Документи", source: tender.sourceUrl },
    });
  }

  const enquiryDate = tender.enquiryDeadline ? new Date(tender.enquiryDeadline) : null;
  const deadlineOpen = deadline ? deadline.getTime() > now.getTime() : false;
  if (enquiryDate && Number.isFinite(enquiryDate.getTime()) && enquiryDate.getTime() <= now.getTime() && deadlineOpen) {
    risks.push({
      id: "enquiry-closed", title: "Період запитів на уточнення завершено",
      description: "Нові запити до замовника вже не приймаються; розбіжності ТД можна вирішувати лише скаргою.",
      level: "low",
      mitigation: "Якщо документація суперечить закону, єдиний інструмент — скарга до дедлайну complaintPeriod.",
      evidence: { label: "Період уточнень", source: tender.sourceUrl, excerpt: tender.enquiryDeadline },
    });
  }

  if (!company?.cpvCodes.length) {
    risks.push({
      id: "profile-unknown", title: "Профіль постачальника не зіставлено",
      description: "Без ваших CPV-кодів, можливостей і сертифікатів сервіс не може підтвердити відповідність предмету закупівлі.", level: "medium",
      mitigation: "Додайте профіль компанії та повторіть аналіз перед рішенням про участь.",
      evidence: { label: "Профіль компанії", source: tender.sourceUrl },
    });
  }

  if (mode === "quick") {
    const tenderDocs = tender.documents.filter((document) => document.title !== "sign.p7s");
    if (tenderDocs.length > 0) {
      risks.push({
        id: "document-review", title: "Файли ще потребують прочитання",
        description: `Швидка перевірка знайшла ${formatFileCount(tenderDocs.length)}, але не робить висновків із повного тексту PDF та додатків.`, level: "medium",
        mitigation: "Відкрийте файли вручну або запустіть поглиблений AI-аналіз.",
        evidence: { label: "Документи закупівлі", source: tender.sourceUrl },
      });
    }

    if (risks.length === 0) {
      risks.push({
        id: "manual-review", title: "Потрібна перевірка повного тексту",
        description: "Структуровані дані не містять усіх формальних і технічних умов.", level: "low",
        mitigation: "Відкрийте файли документації або ввімкніть поглиблений AI-аналіз.",
        evidence: { label: "Дані Prozorro", source: tender.sourceUrl },
      });
    }
  }
  return risks;
}

function formatFileCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? "файл" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "файли" : "файлів";
  return `${count} ${noun}`;
}

function buildNextActions(requirements: TenderRequirement[], risks: TenderRisk[], mode: AnalysisMode): string[] {
  if (mode === "quick") return [];
  const actions = ["Призначити відповідального за фінальну перевірку пакета", "Зіставити кожну вимогу з конкретним файлом-доказом"];
  if (requirements.some((item) => item.id === "guarantee")) actions.unshift("Замовити та перевірити банківську гарантію");
  if (risks.some((risk) => risk.id === "short-deadline")) actions.unshift("Зафіксувати внутрішній дедлайн не пізніше ніж за 12 годин до подання");
  return actions.slice(0, 4);
}
