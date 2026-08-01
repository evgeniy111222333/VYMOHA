import type { NormalizedTender } from "@/src/domain/tender/types";

const API_ROOT = "https://public-api.prozorro.gov.ua/api/2.5/tenders";
const PORTAL_SUMMARY_ROOT = "https://prozorro.gov.ua/api/tenders";
const TENDER_ID_PATTERN = /UA-\d{4}-\d{2}-\d{2}-\d{6}(?:-[a-z])?/i;
const INTERNAL_ID_PATTERN = /^[a-f0-9]{32}$/i;
const MAX_FEED_PAGES = 12;

type ApiEnvelope<T> = { data: T; next_page?: { uri?: string } };
type ApiTender = Record<string, unknown> & { id: string; tenderID?: string };
type Classification = { id?: unknown; description?: unknown };
type TenderDetails = ApiTender & {
  title?: unknown;
  description?: unknown;
  documents?: Array<Record<string, unknown>>;
  criteria?: Array<{ title?: unknown; name?: unknown; description?: unknown }>;
  items?: Array<{ classification?: Classification }>;
  classification?: Classification;
  procuringEntity?: { name?: unknown; identifier?: { id?: unknown; legalName?: unknown } };
  status?: unknown;
  procurementMethodType?: unknown;
  value?: { amount?: unknown; currency?: unknown; valueAddedTaxIncluded?: unknown };
  tenderPeriod?: { endDate?: unknown };
  dateModified?: unknown;
  guarantee?: { amount?: unknown; currency?: unknown };
  minimalStep?: { amount?: unknown };
};

export class TenderNotFoundError extends Error {
  constructor(public readonly externalId: string) {
    super(`Закупівлю ${externalId} не знайдено в останніх оновленнях Prozorro.`);
    this.name = "TenderNotFoundError";
  }
}

export function extractTenderReference(value: string): string {
  const normalized = value.trim();
  const externalMatch = normalized.match(TENDER_ID_PATTERN);
  if (externalMatch) return externalMatch[0].toUpperCase();
  if (INTERNAL_ID_PATTERN.test(normalized)) return normalized.toLowerCase();
  throw new Error("Вкажіть номер у форматі UA-2026-01-01-000001-a або посилання Prozorro.");
}

export async function fetchTender(value: string): Promise<NormalizedTender> {
  const reference = extractTenderReference(value);
  const internalId = INTERNAL_ID_PATTERN.test(reference) ? reference : await resolveInternalId(reference);
  const response = await safeFetch(`${API_ROOT}/${internalId}`);
  if (!response.ok) throw new TenderNotFoundError(reference);
  const envelope = (await response.json()) as ApiEnvelope<ApiTender>;
  return normalizeTender(envelope.data);
}

async function resolveInternalId(externalId: string): Promise<string> {
  const summaryResponse = await fetch(`${PORTAL_SUMMARY_ROOT}/${encodeURIComponent(externalId)}/summary`, {
    headers: { accept: "application/json", "user-agent": "Vymoha/1.0 (+tender-analysis)" },
    signal: AbortSignal.timeout(8_000), cache: "no-store",
  });
  if (summaryResponse.ok) {
    const summary = (await summaryResponse.json()) as { id?: unknown };
    if (typeof summary.id === "string" && INTERNAL_ID_PATTERN.test(summary.id)) return summary.id.toLowerCase();
  }

  let url = `${API_ROOT}?descending=1&limit=100&opt_fields=tenderID,dateModified`;
  for (let page = 0; page < MAX_FEED_PAGES; page += 1) {
    const response = await safeFetch(url);
    if (!response.ok) break;
    const envelope = (await response.json()) as ApiEnvelope<ApiTender[]>;
    const match = envelope.data.find((item) => item.tenderID?.toUpperCase() === externalId);
    if (match) return match.id;
    if (!envelope.next_page?.uri) break;
    url = envelope.next_page.uri;
  }
  throw new TenderNotFoundError(externalId);
}

async function safeFetch(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "public-api.prozorro.gov.ua") throw new Error("Заблоковано непідтримуване джерело даних.");
  return fetch(parsed, {
    headers: { accept: "application/json", "user-agent": "Vymoha/1.0 (+tender-analysis)" },
    signal: AbortSignal.timeout(8_000), cache: "no-store",
  });
}

function normalizeTender(raw: ApiTender): NormalizedTender {
  const record = raw as TenderDetails;
  const docs = Array.isArray(record.documents) ? record.documents : [];
  const criteria = Array.isArray(record.criteria) ? record.criteria : [];
  const mainClassification = record.items?.[0]?.classification ?? record.classification;
  const externalId = String(record.tenderID ?? raw.id);
  return {
    internalId: raw.id,
    externalId,
    sourceUrl: `https://prozorro.gov.ua/tender/${encodeURIComponent(externalId)}`,
    title: String(record.title ?? "Закупівля без назви"),
    description: optionalString(record.description),
    buyer: String(record.procuringEntity?.name ?? record.procuringEntity?.identifier?.legalName ?? "Замовник не вказаний"),
    buyerEdrpou: optionalString(record.procuringEntity?.identifier?.id),
    status: String(record.status ?? "unknown"), method: optionalString(record.procurementMethodType),
    amount: optionalNumber(record.value?.amount), currency: optionalString(record.value?.currency),
    vatIncluded: typeof record.value?.valueAddedTaxIncluded === "boolean" ? record.value.valueAddedTaxIncluded : undefined,
    deadline: optionalString(record.tenderPeriod?.endDate), dateModified: optionalString(record.dateModified),
    cpvCode: optionalString(mainClassification?.id), cpvLabel: optionalString(mainClassification?.description),
    guaranteeAmount: optionalNumber(record.guarantee?.amount), guaranteeCurrency: optionalString(record.guarantee?.currency),
    minimalStepAmount: optionalNumber(record.minimalStep?.amount),
    documents: docs.map((document: Record<string, unknown>) => ({
      id: String(document.id ?? crypto.randomUUID()), title: String(document.title ?? "Документ"),
      format: optionalString(document.format), url: safeDocumentUrl(document.url),
      documentType: optionalString(document.documentType), dateModified: optionalString(document.dateModified),
    })),
    structuredCriteria: criteria.map((criterion) => ({
      title: String(criterion.title ?? criterion.name ?? "Кваліфікаційна вимога"),
      description: optionalString(criterion.description),
    })),
    itemCount: Array.isArray(record.items) ? record.items.length : 0,
  };
}

function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function safeDocumentUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname.endsWith("prozorro.gov.ua") && !url.hostname.endsWith("openprocurement.org")) return undefined;
    return url.toString();
  } catch { return undefined; }
}
