import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { TenderCard } from "@/components/seo/TenderCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getBuyerName, listPublicTenderCardsByBuyer } from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ edrpou: string }> }): Promise<Metadata> {
  const { edrpou } = await params;
  const name = await getBuyerName(edrpou);
  if (!name) return { title: "Замовник не знайдений" };
  return {
    title: `Закупівлі: ${name}`,
    description: `Закупівлі Prozorro замовника ${name}: оцінка готовності, ризики та документи по кожному тендеру.`,
    alternates: { canonical: `/zamovnyky/${edrpou}` },
  };
}

export default async function ZamovnykPage({ params }: { params: Promise<{ edrpou: string }> }) {
  const { edrpou } = await params;
  const cards = await listPublicTenderCardsByBuyer(edrpou, 200);
  if (cards.length === 0) notFound();
  const name = cards[0]?.buyer ?? edrpou;
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Закупівлі", item: `${SITE_ORIGIN}/tendery` },
          { "@type": "ListItem", position: 3, name },
        ],
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Замовник {edrpou}</span>
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
