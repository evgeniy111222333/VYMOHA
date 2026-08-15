export type RiskLevel = "critical" | "high" | "medium" | "low";
export type RequirementStatus = "met" | "missing" | "review" | "unknown";
export type Verdict = "go" | "maybe" | "no-go";

export type EvidenceType = "direct_quote" | "business_inference" | "assumption";

export type Evidence = { 
  label: string; 
  source: string; 
  excerpt?: string;
  evidenceType?: EvidenceType;
};
export type ScoreFactor = {
  id: string;
  label: string;
  points: number;
  description: string;
  kind: "base" | "positive" | "negative" | "limit";
};

export type BuyerContext = {
  buyerEdrpou: string;
  sampleSize: number;
  decidedAwards: number;
  disqualifiedAwards: number;
  tendersWithDisqualifications: number;
  disqualificationRate: number;
  averageBids: number;
  periodStart: string;
  periodEnd: string;
  sourceUrl: string;
};

export type CompetitionLevel = "low" | "normal" | "high" | "unknown";

export type RedFlagSeverity = "info" | "warning";

export type RedFlagSignal = {
  id: string;
  title: string;
  severity: RedFlagSeverity;
  description: string;
  evidence: { label: string; source: string; excerpt?: string };
};

export type CompetitionRiskLevel = "low" | "medium" | "high";

/**
 * Ризики для учасника за об'єктивними відкритими даними: ознаки низької
 * конкуренції та зміни документації після публікації. Це не оцінка
 * законності дій замовника, а сигнали, що впливають на рішення про участь.
 * Кожен сигнал має доказ і є перевірюваним.
 */
export type CompetitionRisk = {
  level: CompetitionRiskLevel;
  flags: RedFlagSignal[];
  /** Розмір конкурентної вибірки аналогів (сигнали історії рахуються при ≥5). */
  sampleSize: number;
};

export type ContractRiskCategory = "fine" | "penalty" | "force_majeure" | "termination" | "payment" | "guarantee" | "other";
export type ContractRiskSeverity = "low" | "medium" | "high" | "critical";

export type ContractRiskItem = {
  id: string;
  category: ContractRiskCategory;
  title: string;
  description: string;
  severity: ContractRiskSeverity;
  evidence: Evidence;
};

export type PricePosition = {
  id: string;
  position: string;
  quantity: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  note: string;
  evidence: Evidence;
};

/**
 * Конкурентний бенчмарк: агрегат по історичних завершених закупівлях
 * (той самий CPV / регіон). Відносні метрики (медіана дисконту, медіана
 * учасників), а не абсолютні ціни — так інфляція та ПДВ не спотворюють
 * висновок. Цільова ціна виводиться з очікуваної вартості поточного
 * тендера множенням на (1 − медіанний дисконт).
 */
export type MarketContext = {
  scope: "market" | "buyer";
  cpvClass: string;
  region: string | null;
  sampleSize: number;
  discountSampleSize: number;
  windowMonths: number;
  medianParticipants: number | null;
  medianDiscount: number | null;
  discountP25: number | null;
  discountP75: number | null;
  singleBidderRate: number | null;
  competitionLevel: CompetitionLevel;
  confidence: "high" | "low";
  topCompetitors: Array<{ edrpou: string; wins: number }>;
  sourceUrl: string;
};

export type MatchType = "exact_table_match" | "general_clause" | "not_applicable";

export type TenderRequirement = {
  id: string;
  title: string;
  description: string;
  category: "deadline" | "financial" | "legal" | "technical" | "experience" | "document";
  status: RequirementStatus;
  matchType?: MatchType;
  evidence: Evidence;
};

export type TenderRisk = {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
  /**
   * true — участь юридично неможлива або фінансово руйнівна (дедлайн минув,
   * дискваліфікаційна вимога без альтернатив). Лише такі критичні ризики
   * активують стоп-кап у зваженій матриці. Визначається промптом або
   * детерміновано; для сумнівних випадків має бути false.
   */
  isStopFactor?: boolean;
  mitigation: string;
  evidence: Evidence;
};

export type TenderDocument = {
  id: string;
  title: string;
  format?: string;
  url?: string;
  documentType?: string;
  dateModified?: string;
};

export type TenderLot = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  amount?: number;
  currency?: string;
  vatIncluded?: boolean;
  minimalStepAmount?: number;
  guaranteeAmount?: number;
  guaranteeCurrency?: string;
  auctionStartDate?: string;
};

export type StructuredCriterion = {
  title: string;
  description?: string;
  numericRequirements?: Array<{
    title?: string;
    expectedValue?: string;
    minValue?: string;
    maxValue?: string;
  }>;
};

export type TenderClarification = {
  title?: string;
  question?: string;
  answer?: string;
  date?: string;
};

export type TenderMilestone = {
  type?: string;
  title?: string;
  description?: string;
  dueDate?: string;
};

export type NormalizedTender = {
  internalId: string;
  externalId: string;
  sourceUrl: string;
  title: string;
  description?: string;
  buyer: string;
  buyerEdrpou?: string;
  region?: string;
  status: string;
  method?: string;
  amount?: number;
  currency?: string;
  vatIncluded?: boolean;
  deadline?: string;
  datePublished?: string;
  dateModified?: string;
  auctionStartDate?: string;
  hasAuction?: boolean;
  cpvCode?: string;
  cpvLabel?: string;
  guaranteeAmount?: number;
  guaranteeCurrency?: string;
  minimalStepAmount?: number;
  awardCriteria?: string;
  enquiryDeadline?: string;
  complaintDeadline?: string;
  clarifications?: TenderClarification[];
  milestones?: TenderMilestone[];
  documents: TenderDocument[];
  structuredCriteria: StructuredCriterion[];
  itemCount: number;
  lots?: TenderLot[];
};

export type RequiredDocumentCategory = "statutory" | "qualification" | "technical" | "financial" | "other";

export type RequiredDocumentItem = {
  id: string;
  category: RequiredDocumentCategory;
  title: string;
  description: string;
  note?: string;
  requiredType?: "document" | "statement" | "either";
  evidence?: Evidence;
};

export type CompanyProfile = {
  name?: string;
  edrpou?: string;
  cpvCodes: string[];
  certifications: string[];
  capabilities: string[];
};

export type TenderRevisionChange = {
  op: string;
  path: string;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
};

export type TenderRevision = {
  id: string;
  date: string;
  author: string;
  changes: TenderRevisionChange[];
};

export type TenderRevisionsAnalysis = {
  impactLevel: "critical" | "warning" | "info";
  summary: string;
  actionRequired: string;
  hasRevisions: boolean;
  revisions: TenderRevision[];
};

export type TenderAnalysis = {
  id: string;
  tender: NormalizedTender;
  verdict: Verdict;
  score: number;
  confidence: number;
  scoreFactors: ScoreFactor[];
  buyerContext?: BuyerContext;
  marketContext?: MarketContext;
  competitionRisk?: CompetitionRisk;
  summary: string;
  generatedAt: string;
  mode: "structured" | "ai-enhanced";
  analysisTier?: "quick" | "deep" | "expert";
  requirements: TenderRequirement[];
  risks: TenderRisk[];
  nextActions: string[];
  questionsToBuyer?: string[];
  documentCoverage?: Array<{ title: string; status: "read" | "partial" | "unavailable"; notes: string }>;
  requiredDocumentsChecklist?: RequiredDocumentItem[];
  contractRiskMatrix?: ContractRiskItem[];
  priceAnalysis?: PricePosition[];
  revisionsAnalysis?: TenderRevisionsAnalysis;
  disclaimer: string;
  creditsCharged?: number;
};
