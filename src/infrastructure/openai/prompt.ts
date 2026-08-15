import type { CompanyProfile, TenderAnalysis, TenderDocument } from "@/src/domain/tender/types";

const statusMap: Record<string, string> = {
  "active.enquiries": "Період уточнень",
  "active.tendering": "Прийом пропозицій",
  "active.auction": "Аукціон",
  "active.qualification": "Кваліфікація переможця",
  "active.awarded": "Визначено переможця",
  "unsuccessful": "Закупівля не відбулася",
  "cancelled": "Відмінена",
  "complete": "Завершено",
};

const methodMap: Record<string, string> = {
  "reporting": "Звітування про укладений договір",
  "belowThreshold": "Допорогова закупівля",
  "aboveThreshold": "Відкриті торги",
  "aboveThresholdUA": "Відкриті торги з особливостями",
  "aboveThresholdEU": "Відкриті торги з публікацією англ. мовою",
  "negotiation": "Переговорна процедура",
  "negotiation.quick": "Переговорна процедура (скорочена)",
};

/**
 * Ринковий бенчмарк — детерміновані факти з історичних даних Prozorro.
 * Модель може їх цитувати, але ЗАБОРОНЕНО вигадувати цифри поза цим блоком.
 */
function buildMarketBlock(analysis: TenderAnalysis): string {
  const market = analysis.marketContext;
  if (!market) return "";
  const discountPercent = market.medianDiscount !== null ? `${Math.round(market.medianDiscount * 100)}%` : "н/д";
  const participants = market.medianParticipants !== null ? String(market.medianParticipants) : "н/д";
  const target = market.medianDiscount !== null && analysis.tender.amount
    ? `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(analysis.tender.amount * (1 - market.medianDiscount)))} ${analysis.tender.currency ?? "UAH"}`
    : "н/д";
  const scope = market.scope === "buyer" ? "цього замовника" : `ринку за CPV ${market.cpvClass}${market.region ? ` у ${market.region}` : ""}`;
  const competitors = market.topCompetitors.length
    ? market.topCompetitors.map((c) => `ЄДРПОУ ${c.edrpou} (${c.wins} перемог)`).join(", ")
    : "немає даних";
  return `РИНКОВИЙ БЕНЧМАРК (вибірка ${market.sampleSize} аналогічних закупівель ${scope}, ${market.windowMonths} міс):
- медіана учасників: ${participants};
- медіанний дисконт переможця: ${discountPercent};
- цільова ціна поточної закупівлі: ${target};
- частка закупівель з ≤1 учасником: ${market.singleBidderRate !== null ? `${Math.round(market.singleBidderRate * 100)}%` : "н/д"};
- повторювані переможці: ${competitors}.
Ці цифри — факти, не оцінки. Згадуй їх у summary/risks лише як довідковий контекст, не перераховуй і не змінюй.`;
}

/**
 * Ознаки низької конкуренції — об'єктивні сигнали з відкритих даних.
 * Модель може їх згадувати, але НЕ має вигадувати власні «ознаки корупції».
 */
function buildCompetitionBlock(analysis: TenderAnalysis): string {
  const risk = analysis.competitionRisk;
  if (!risk || risk.flags.length === 0) return "";
  const lines = risk.flags.map((flag) => `- ${flag.title}: ${flag.description}`);
  const scope = risk.sampleSize >= 5 ? ` (вибірка ${risk.sampleSize} аналогів)` : "";
  return `ОЗНАКИ РИЗИКУ ДЛЯ УЧАСНИКА${scope} (рівень ${risk.level}):
${lines.join("\n")}
Це статистичні сигнали з відкритих даних, не оцінка законності дій замовника. Згадуй їх у risks як довідку, але не стверджуй «заточеність» чи «корупцію».`;
}

/**
 * Промпт другого проходу expert-режиму: глибокий юридичний скан проєкту
 * договору та специфікації. Це окремий виклик із вищим рівнем роздуму.
 */
export function buildContractScanPrompt(analysis: TenderAnalysis): string {
  const tender = analysis.tender;
  const structured = JSON.stringify({
    title: tender.title, buyer: tender.buyer, amount: tender.amount,
    currency: tender.currency, vatIncluded: tender.vatIncluded,
    cpvCode: tender.cpvCode, cpvLabel: tender.cpvLabel, itemCount: tender.itemCount,
  });
  return `Ти — юрист-контрактник, що готує постачальника до участі в закупівлі. Проведи ГЛИБОКИЙ аудит проєкту договору та специфікації.

ЗАКУПІВЛЯ: ${structured}

Завдання:
1. contractRiskMatrix — вичерпна матриця ризиків договору ПО ПУНКТАХ. Для кожного ризику: category (fine | penalty | force_majeure | termination | payment | guarantee | other), title (назва пункту), description (суть і конкретний розмір/умова), severity (low | medium | high | critical), evidence з ТОЧНОЮ цитатою з файлу договору.
2. priceAnalysis — по КОЖНІЙ позиції специфікації: position (назва), quantity (кількість, якщо вказано), unitPrice (ціна за одиницю, якщо вказано), totalPrice (підсумок, якщо вказано), note (зауваження/ризик/брак даних), evidence з цитатою зі специфікації.

Правила:
- Цитуй ТІЛЬКИ з наданих файлів. Не вигадуй цифри.
- Якщо ціни/кількості в документах нема — НЕ став «0» або «0.00»: просто пропусти відповідне поле. Якщо в специфікації є гранична/орієнтовна ціна — вкажи її в unitPrice, а не в note.
- Не дублюй один і той самий ризик; групуй близькі пункти.
- Відповідай тільки за заданою JSON-схемою.`;
}

export function buildTenderPrompt(analysis: TenderAnalysis, company?: CompanyProfile, documentsToSend?: TenderDocument[]): string {
  const tender = analysis.tender;
  const companyContext = company
    ? JSON.stringify({ name: company.name, edrpou: company.edrpou, cpvCodes: company.cpvCodes, certifications: company.certifications, capabilities: company.capabilities })
    : "Профіль постачальника не надано. Не підтверджуй відповідність постачальника і не став verdict=go.";
    
  // Лише файли, які фактично передаються моделі. Показ назв файлів, які не
  // надіслано, змушує модель домальовувати їх у documentCoverage як "read".
  const documents = documentsToSend ?? tender.documents;
  const structured = JSON.stringify({
    externalId: tender.externalId, title: tender.title, description: tender.description, buyer: tender.buyer,
    status: statusMap[tender.status] || tender.status,
    method: tender.method ? (methodMap[tender.method] || tender.method) : undefined,
    amount: tender.amount, currency: tender.currency, vatIncluded: tender.vatIncluded,
    deadline: tender.deadline, enquiryDeadline: tender.enquiryDeadline, complaintDeadline: tender.complaintDeadline,
    awardCriteria: tender.awardCriteria === "lowestCost" ? "найнижча ціна" : tender.awardCriteria,
    cpvCode: tender.cpvCode, cpvLabel: tender.cpvLabel,
    guaranteeAmount: tender.guaranteeAmount, minimalStepAmount: tender.minimalStepAmount,
    itemCount: tender.itemCount, criteria: tender.structuredCriteria,
    clarifications: tender.clarifications, milestones: tender.milestones,
    documents: documents.map((item) => ({ title: item.title, format: item.format, documentType: item.documentType, dateModified: item.dateModified })),
  });

  return `Ти — старший тендерний аналітик українського постачальника. Проаналізуй закупівлю Prozorro та всі прикріплені файли українською мовою.

ЗАКУПІВЛЯ: ${structured}
ПРОФІЛЬ ПОСТАЧАЛЬНИКА: ${companyContext}
${buildMarketBlock(analysis)}
${buildCompetitionBlock(analysis)}
ДЖЕРЕЛО: ${tender.sourceUrl}

Побудуй доказовий go / maybe / no-go висновок. Окремо знайди:
1) точні строки, забезпечення, кваліфікаційні вимоги;
2) вичерпний чек-лист усіх документів (requiredDocumentsChecklist), які учасник повинен завантажити в Prozorro для участі у цій закупівлі (довідки МВС/ДПС, МТБ, працівники, досвід, паспорти якості, листи-гарантії);
3) ОБОВ'ЯЗКОВИЙ СКАН ДОГОВОРУ. Проведи системний аналіз проекту договору на наявність усіх ключових ризиків. Додай у 'risks' або 'requirements' усі знайдені:
   - Розміри штрафів та пені за прострочення чи порушення.
   - Умови настання форс-мажорних обставин.
   - Умови одностороннього розірвання договору.
   - Умови оплати та можливі відстрочки.
4) невідповідності профілю постачальника;
5) питання, які варто поставити замовнику до дедлайну.

Правила якості:
- Для категорії 'technical' ти ЗОБОВ'ЯЗАНИЙ знайти повну таблицю технічної специфікації (всі позиції товарів чи послуг) і звірити КОЖНУ позицію з \`capabilities\` профілю компанії. Не можна ставити status='met' на основі загальних юридичних фраз (напр. 'відповідає стандартам'). Статут 'met' вимагає підтвердження кожної фізичної позиції. Якщо є невідомі позиції чи розбіжності, став 'review' і виводь їх перелік. Завжди використовуй поле 'matchType' ('exact_table_match' для повної перевірки таблиці специфікації, 'general_clause' для загальних фраз, 'not_applicable' для інших категорій).
- Врахуй дедлайн запитів на уточнення (enquiryDeadline): якщо він минув, згадай це в requirements або risks. Опубліковані відповіді замовника (clarifications) — готові роз'яснення вимог: використовуй їх як докази замість припущень. Критерій визначення переможця (awardCriteria) згадай у requirements.
- ЗАБОРОНЕНО додавати ризики чи вимоги про відсутність профілю постачальника або невідомі дані про компанію-учасника — система враховує це автоматично у власному скорингу. Аналізуй лише об'єктивні властивості закупівлі.
- Поле isStopFactor у ризиках: став true ЛИШЕ якщо участь юридично неможлива або фінансово руйнівна (дедлайн подання минув, дискваліфікаційна вимога без жодної альтернативи). Штрафні санкції, відстрочки платежів, жорсткі умови договору — це рівень 'high' або нижче з isStopFactor=false.
- У summary НЕ зазначай вердикт чи рішення про участь (go / maybe / no-go, 'заходити / не заходити') — фінальний вердикт і бал обчислює система окремо. Summary описує лише факти й ризики.
- requiredDocumentsChecklist має містити вичерпний список файлів і довідок для подачі: category (statutory|qualification|technical|financial|other), title (точна назва), description (умови розробки), note (підказка про орган чи форму), requiredType (document|statement|either), та обов'язково evidence: { label, source, excerpt, evidenceType };
- ЗАБОРОНЕНО цитувати технічний блок "ЗАКУПІВЛЯ" (наприклад, суми, статуси чи методи) як докази для вимог чи ризиків. Всі докази (evidence.excerpt) бери ВИКЛЮЧНО з текстів прикріплених файлів тендерної документації, або з блоку criteria!
- кожен ризик і вимога повинні містити evidence з назвою файлу/розділу та коротким точним excerpt. У полі 'evidenceType' вказуй 'direct_quote' (точна цитата), 'business_inference' (висновок з фактів) або 'assumption' (припущення);
- якщо доказу немає, status=unknown або review, а не met;
- якщо дедлайн подання минув або статус процедури закритий/кваліфікація (status не "Прийом пропозицій"), ОБОВ'ЯЗКОВО вкажи в першому реченні summary, що прийом пропозицій закритий, та додай у risks критичний ризик 'Дедлайн подання минув' з isStopFactor=true;
- verdict=go дозволений лише за наявності профілю постачальника, прочитаних ключових файлів і відсутності критичних стоп-факторів;
- score відображає готовність саме цього постачальника, а confidence — повноту доступних доказів;
- source в evidence завжди має бути ${tender.sourceUrl};
- відповідай тільки за заданою JSON-схемою.`;
}
