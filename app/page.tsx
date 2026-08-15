import type { Metadata } from "next";
import { AnalyzerForm } from "@/components/analyzer/AnalyzerForm";
import { Faq } from "@/components/marketing/Faq";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Hero } from "@/components/marketing/Hero";
import { Pricing } from "@/components/marketing/Pricing";
import { ProductProof } from "@/components/marketing/ProductProof";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <section className="analyzer-strip" id="analyze" data-reveal>
        <div className="container analyzer-strip__inner">
          <div className="section-index">00 / TRY IT NOW</div>
          <h2>Почніть із тендера,<br /><em>а не з реєстрації.</em></h2>
          <p className="section-lead">Вставте ID активної закупівлі Prozorro. За кілька секунд отримаєте безплатний структурований фільтр без входу.</p>
          <AnalyzerForm variant="embedded" />
        </div>
      </section>
      <ProductProof />
      <FeatureGrid />
      <Pricing />
      <Faq />
      <SiteFooter />
    </main>
  );
}
