import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenderCard } from "@/components/seo/TenderCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { listPublicTenderCardsByCpv } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ cpv: string }> }): Promise<Metadata> {
  const { cpv } = await params;
  const cards = await listPublicTenderCardsByCpv(cpv, 1);
  if (cards.length === 0) return { title: "Категорія не знайдена" };
  const label = cards[0]?.cpvLabel ?? `CPV ${cpv}`;
  return {
    title: `Тендери: ${label}`,
    description: `Закупівлі Prozorro у категорії «${label}»: оцінка готовності, ризики та документи по кожному тендеру.`,
    alternates: { canonical: `/tendery/${cpv}` },
  };
}

export default async function TenderyCpvPage({ params }: { params: Promise<{ cpv: string }> }) {
  const { cpv } = await params;
  const cards = await listPublicTenderCardsByCpv(cpv, 200);
  if (cards.length === 0) notFound();
  const label = cards[0]?.cpvLabel ?? `CPV ${cpv}`;
  return (
    <main>
      <SiteHeader />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Категорія {cpv}</span>
          <h1>{label}</h1>
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
