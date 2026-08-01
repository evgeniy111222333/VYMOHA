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
  deep: { id: "deep", label: "Поглиблений", credits: 12, modelClass: "balanced", detail: "До 5 файлів, вимоги, ризики та питання" },
  expert: { id: "expert", label: "Експертний", credits: 30, modelClass: "frontier", detail: "До 8 файлів і максимальна перевірка доказів" },
} as const satisfies Record<AnalysisTier, { id: AnalysisTier; label: string; credits: number; modelClass: string; detail: string }>;

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "signal", name: "Спроба", credits: 30, amountMinor: 14_900, currency: "uah", description: "1 експертний або 2 поглиблені аналізи" },
  { id: "team", name: "Старт", credits: 100, amountMinor: 39_900, currency: "uah", description: "До 8 поглиблених або 3 експертних аналізів", popular: true },
  { id: "scale", name: "Команда", credits: 300, amountMinor: 99_900, currency: "uah", description: "До 25 поглиблених або 10 експертних аналізів" },
];

export function getCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((item) => item.id === id);
}

export function getAnalysisTier(id: AnalysisTier) {
  return ANALYSIS_TIERS[id];
}
