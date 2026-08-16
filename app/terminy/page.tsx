import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { terms } from "@/src/content/terms";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const metadata: Metadata = {
  title: "Словник термінів Prozorro",
  description: "Короткий словник термінів державних закупівель Prozorro: тендерна документація, КЕП, аналогічний договір, аукціон та інші.",
  alternates: { canonical: "/terminy" },
};

export default function TerminyPage() {
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Словник термінів", item: `${SITE_ORIGIN}/terminy` },
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Словник термінів Prozorro",
        itemListElement: terms.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: { "@type": "DefinedTerm", name: item.term, description: item.definition, inDefinedTermSet: { "@type": "DefinedTermSet", name: "Словник Prozorro" } },
        })),
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Словник</span>
          <h1>Терміни Prozorro<br />простою мовою.</h1>
          <p>Короткі визначення ключових понять публічних закупівель, щоб швидко орієнтуватися в тендерній документації.</p>
          <div className="guide-grid">
            {terms.map((item, index) => (
              <div key={item.term} className="term-card" data-reveal data-spot style={{ "--reveal-delay": `${index * 30}ms` } as React.CSSProperties}>
                <span className="mono">0{index + 1}</span>
                <h2>{item.term}</h2>
                <p>{item.definition}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48 }}>
            <Link href="/guides" className="button button--dark">Переглянути базу знань</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
