import { AnalyzerForm } from "@/components/analyzer/AnalyzerForm";
import { Faq } from "@/components/marketing/Faq";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Hero } from "@/components/marketing/Hero";
import { Pricing } from "@/components/marketing/Pricing";
import { ProductProof } from "@/components/marketing/ProductProof";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <section className="analyzer-strip" id="analyze">
        <div className="container analyzer-strip__inner">
          <div className="section-kicker">Безплатна перевірка</div>
          <h2>Вставте номер закупівлі. Решту розкладемо по полицях.</h2>
          <p className="section-lead">Працює з активними закупівлями Prozorro. Базовий звіт не потребує реєстрації.</p>
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
