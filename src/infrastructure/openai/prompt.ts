import type { CompanyProfile, TenderAnalysis } from "@/src/domain/tender/types";

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

export function buildTenderPrompt(analysis: TenderAnalysis, company?: CompanyProfile): string {
  const tender = analysis.tender;
  const companyContext = company
    ? JSON.stringify({ name: company.name, edrpou: company.edrpou, cpvCodes: company.cpvCodes, certifications: company.certifications, capabilities: company.capabilities })
    : "Профіль постачальника не надано. Не підтверджуй відповідність постачальника і не став verdict=go.";
    
  const structured = JSON.stringify({
    externalId: tender.externalId, title: tender.title, description: tender.description, buyer: tender.buyer,
    status: statusMap[tender.status] || tender.status, 
    method: methodMap[tender.method] || tender.method, 
    amount: tender.amount, currency: tender.currency,
    deadline: tender.deadline, cpvCode: tender.cpvCode, cpvLabel: tender.cpvLabel,
    guaranteeAmount: tender.guaranteeAmount, minimalStepAmount: tender.minimalStepAmount,
    itemCount: tender.itemCount, criteria: tender.structuredCriteria,
    documents: tender.documents.map((item) => ({ title: item.title, format: item.format, documentType: item.documentType, dateModified: item.dateModified })),
  });

  return `Ти — старший тендерний аналітик українського постачальника. Проаналізуй закупівлю Prozorro та всі прикріплені файли українською мовою.

ЗАКУПІВЛЯ: ${structured}
ПРОФІЛЬ ПОСТАЧАЛЬНИКА: ${companyContext}
ДЖЕРЕЛО: ${tender.sourceUrl}

Побудуй доказовий go / maybe / no-go висновок. Окремо знайди:
1) точні строки, забезпечення, кваліфікаційні та технічні вимоги;
2) вичерпний чек-лист усіх документів (requiredDocumentsChecklist), які учасник повинен завантажити в Prozorro для участі у цій закупівлі (довідки МВС/ДПС, МТБ, працівники, досвід, паспорти якості, листи-гарантії);
3) дискримінаційні, неоднозначні чи ризикові умови;
4) невідповідності профілю постачальника;
5) питання, які варто поставити замовнику до дедлайну.

Правила якості:
- requiredDocumentsChecklist має містити вичерпний список файлів і довідок для подачі: category (statutory|qualification|technical|financial|other), title (точна назва), description (умови розробки), note (підказка про орган чи форму), requiredType (document|statement|either), та обов'язково evidence: { label (назва файлу або Постанова №1178), source (${tender.sourceUrl}), excerpt (ТОЧНА ЦИТАТА-ДОКАЗ із файлу ТД українською мовою, щоб користувач міг знайти її через Ctrl+F) };
- ЗАБОРОНЕНО цитувати технічний блок "ЗАКУПІВЛЯ" (наприклад, суми, статуси чи методи) як докази для вимог чи ризиків. Всі докази (evidence.excerpt) бери ВИКЛЮЧНО з текстів прикріплених файлів тендерної документації, або з блоку criteria!
- не вигадуй сторінки, цитати, вимоги чи відповідність;
- кожен ризик і вимога повинні містити evidence з назвою файлу/розділу та коротким точним excerpt;
- якщо доказу немає, status=unknown або review, а не met;
- якщо дедлайн подання минув або статус процедури закритий/кваліфікація (status не "Прийом пропозицій"), ОБОВ'ЯЗКОВО вкажи в першому реченні summary, що прийом пропозицій закритий, та додай у risks критичний ризик 'Дедлайн подання минув';
- verdict=go дозволений лише за наявності профілю постачальника, прочитаних ключових файлів і відсутності критичних стоп-факторів;
- score відображає готовність саме цього постачальника, а confidence — повноту доступних доказів;
- source в evidence завжди має бути ${tender.sourceUrl};
- відповідай тільки за заданою JSON-схемою.`;
}
