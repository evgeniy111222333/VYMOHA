export type AnalysisTier = "quick" | "deep" | "expert";

export type CreditPackage = {
  id: "signal" | "team" | "scale";
  name: string;
  credits: number;
  amountMinor: number;
  currency: "uah";
  description: string;
  popular?: boolean;
};

export const ANALYSIS_TIERS = {
  quick: { id: "quick", label: "Швидкий", credits: 0, modelClass: "rules", detail: "Ключові дані та первинний відбір" },
  deep: { id: "deep", label: "Поглиблений", credits: 30, modelClass: "balanced", detail: "Документи, вимоги, ризики та питання" },
  expert: { id: "expert", label: "Експертний", credits: 65, modelClass: "frontier", detail: "Максимальна глибина та перевірка доказів" },
} as const satisfies Record<AnalysisTier, { id: AnalysisTier; label: string; credits: number; modelClass: string; detail: string }>;

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "signal", name: "Старт", credits: 120, amountMinor: 49_000, currency: "uah", description: "До 4 поглиблених або 1 експертна + 1 поглиблена перевірка" },
  { id: "team", name: "Команда", credits: 400, amountMinor: 129_000, currency: "uah", description: "Для регулярної тендерної роботи", popular: true },
  { id: "scale", name: "Відділ", credits: 1_000, amountMinor: 269_000, currency: "uah", description: "Найнижча ціна кредиту для команд" },
];

export function getCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((item) => item.id === id);
}

export function getAnalysisTier(id: AnalysisTier) {
  return ANALYSIS_TIERS[id];
}
