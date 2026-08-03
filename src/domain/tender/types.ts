export type RiskLevel = "critical" | "high" | "medium" | "low";
export type RequirementStatus = "met" | "missing" | "review" | "unknown";
export type Verdict = "go" | "maybe" | "no-go";

export type Evidence = { label: string; source: string; excerpt?: string };

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

export type TenderRequirement = {
  id: string;
  title: string;
  description: string;
  category: "deadline" | "financial" | "legal" | "technical" | "experience" | "document";
  status: RequirementStatus;
  evidence: Evidence;
};

export type TenderRisk = {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
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

export type NormalizedTender = {
  internalId: string;
  externalId: string;
  sourceUrl: string;
  title: string;
  description?: string;
  buyer: string;
  buyerEdrpou?: string;
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
  documents: TenderDocument[];
  structuredCriteria: Array<{ title: string; description?: string }>;
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
  revisionsAnalysis?: TenderRevisionsAnalysis;
  disclaimer: string;
  creditsCharged?: number;
};
