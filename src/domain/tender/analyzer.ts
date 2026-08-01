import { scoreTender } from "./scoring";
import type { BuyerContext, CompanyProfile, NormalizedTender, TenderAnalysis, TenderRequirement, TenderRisk } from "./types";

const formatter = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });

export function analyzeTender(tender: NormalizedTender, company?: CompanyProfile, now = new Date(), buyerContext?: BuyerContext): TenderAnalysis {
  const score = scoreTender(tender, company, now, buyerContext);
  const requirements = buildRequirements(tender, company, now);
  const risks = buildRisks(tender, company, now);
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
    summary: score.verdict === "go"
      ? `Закупівля виглядає перспективною. Перед поданням підтвердьте ${reviewCount} пунктів, які потребують ручної перевірки.`
      : score.verdict === "maybe"
        ? `Потенціал є, але рішення залежить від ${Math.max(1, missingCount + reviewCount)} відкритих вимог. Не формуйте пропозицію до їх перевірки.`
        : isDeadlineClosed(tender, now)
          ? "Подання пропозицій завершено — це головна причина низького балу. Відповідність вашої компанії та зміст файлів у швидкому режимі не оцінювались."
          : "Виявлено стоп-фактори. Спершу усуньте критичні розбіжності та перевірте файли закупівлі.",
    generatedAt: now.toISOString(),
    mode: "structured",
    requirements,
    risks,
    nextActions: buildNextActions(requirements, risks),
    disclaimer: "Автоматичний аналіз є допоміжним інструментом і не замінює юридичну перевірку або рішення відповідальної особи.",
  };
}

function isDeadlineClosed(tender: NormalizedTender, now: Date): boolean {
  if (!tender.deadline) return false;
  const deadline = new Date(tender.deadline);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() < now.getTime();
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

function buildRisks(tender: NormalizedTender, company: CompanyProfile | undefined, now: Date): TenderRisk[] {
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

  if (!company?.cpvCodes.length) {
    risks.push({
      id: "profile-unknown", title: "Профіль постачальника не зіставлено",
      description: "Без ваших CPV-кодів, можливостей і сертифікатів сервіс не може підтвердити відповідність предмету закупівлі.", level: "medium",
      mitigation: "Додайте профіль компанії та повторіть аналіз перед рішенням про участь.",
      evidence: { label: "Профіль компанії", source: tender.sourceUrl },
    });
  }

  const tenderDocs = tender.documents.filter((document) => document.title !== "sign.p7s");
  if (tenderDocs.length > 0) {
    risks.push({
      id: "document-review", title: "Файли ще потребують прочитання",
      description: `Базовий режим знайшов ${formatFileCount(tenderDocs.length)}, але не робить висновків із повного тексту PDF та додатків.`, level: "medium",
      mitigation: "Відкрийте файли вручну або запустіть поглиблений AI-аналіз після входу.",
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
  return risks;
}

function formatFileCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? "файл" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "файли" : "файлів";
  return `${count} ${noun}`;
}

function buildNextActions(requirements: TenderRequirement[], risks: TenderRisk[]): string[] {
  const actions = ["Призначити відповідального за фінальну перевірку пакета", "Зіставити кожну вимогу з конкретним файлом-доказом"];
  if (requirements.some((item) => item.id === "guarantee")) actions.unshift("Замовити та перевірити банківську гарантію");
  if (risks.some((risk) => risk.id === "short-deadline")) actions.unshift("Зафіксувати внутрішній дедлайн не пізніше ніж за 12 годин до подання");
  return actions.slice(0, 4);
}
