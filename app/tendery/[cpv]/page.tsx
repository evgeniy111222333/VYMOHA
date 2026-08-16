import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { TenderCard } from "@/components/seo/TenderCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { cpvDivisionName } from "@/src/content/cpv";
import { listPublicTenderCardsByCpv } from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ cpv: string }> }): Promise<Metadata> {
  const { cpv } = await params;
  const cards = await listPublicTenderCardsByCpv(cpv, 1);
  if (cards.length === 0) return { title: "Категорія не знайдена" };
  const name = cpvDivisionName(cpv) ?? cards[0]?.cpvLabel ?? `CPV ${cpv}`;
  return {
    title: `${name} — тендери Prozorro`,
    description: `Закупівлі Prozorro у категорії «${name}»: оцінка готовності, ризики та документи по кожному тендеру.`,
    alternates: { canonical: `/tendery/${cpv}` },
  };
}

export default async function TenderyCpvPage({ params }: { params: Promise<{ cpv: string }> }) {
  const { cpv } = await params;
  const cards = await listPublicTenderCardsByCpv(cpv, 200);
  if (cards.length === 0) notFound();
  const name = cpvDivisionName(cpv) ?? cards[0]?.cpvLabel ?? `CPV ${cpv}`;
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Тендери", item: `${SITE_ORIGIN}/tendery` },
          { "@type": "ListItem", position: 3, name },
        ],
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Категорія CPV {cpv}</span>
          <h1>{name}</h1>
          <p>{cards.length} {cards.length === 1 ? "закупівля" : cards.length < 5 ? "закупівлі" : "закупівель"} Prozorro з попередньою оцінкою готовності.</p>
          <div className="guide-grid">
            {cards.map((card) => <TenderCard key={card.tenderExternalId} card={card} />)}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
