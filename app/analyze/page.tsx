import type { Metadata } from "next";
import { AnalyzerForm } from "@/components/analyzer/AnalyzerForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Перевірити тендер Prozorro",
  description: "Безплатний первинний аналіз закупівлі Prozorro: дедлайни, забезпечення, документи, вимоги та ризики.",
  alternates: { canonical: "/analyze" },
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const source = (await searchParams).source?.slice(0, 180) ?? "";
  return <main><SiteHeader /><section className="analyze-page"><div className="container analyze-page__heading"><span className="section-kicker">Аналізатор</span><h1>Розберіть закупівлю<br />до першого документа.</h1><p>Вставте номер активної закупівлі Prozorro. Публічна перевірка покаже реквізити, структуровані критерії та стоп-фактори.</p></div><div className="container"><AnalyzerForm variant="page" defaultValue={source} allowDeepAnalysis /></div></section><SiteFooter /></main>;
}
