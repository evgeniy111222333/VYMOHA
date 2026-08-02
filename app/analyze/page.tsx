import type { Metadata } from "next";
import { signInPath as chatGPTSignInPath, getAuthUser as getChatGPTUser } from "@/app/auth";
import { AnalyzerForm } from "@/components/analyzer/AnalyzerForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Перевірити тендер Prozorro",
  description: "Безплатний первинний аналіз закупівлі Prozorro: дедлайни, забезпечення, документи, вимоги та ризики.",
  alternates: { canonical: "/analyze" },
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ source?: string; tier?: string }> }) {
  const params = await searchParams;
  const source = params.source?.slice(0, 180) ?? "";
  const tier = params.tier === "deep" || params.tier === "expert" || params.tier === "quick" ? params.tier : undefined;
  const user = await getChatGPTUser();
  const account = user ? await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName }) : null;
  return <main><SiteHeader /><section className="analyze-page"><div className="container analyze-page__heading"><span className="section-kicker">Tender intelligence console</span><h1>Один тендер.<br /><em>Три рівні глибини.</em></h1><p>Від безплатного відсіву до повного аналізу документів із доказами, питаннями замовнику й персональним go/no-go.</p></div><div className="container"><AnalyzerForm variant="page" defaultValue={source} defaultTier={tier} allowDeepAnalysis signedIn={Boolean(user)} initialCredits={account?.creditBalance ?? 0} signInHref={chatGPTSignInPath(`/analyze${source ? `?source=${encodeURIComponent(source)}` : ""}`)} /></div></section><SiteFooter /></main>;
}
