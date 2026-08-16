import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { TenderCard } from "@/components/seo/TenderCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { cpvClassName, cpvDivisionName } from "@/src/content/cpv";
import { listPublicTenderCardsByCpv, listTenderClasses } from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ division: string }> }): Promise<Metadata> {
  const { division } = await params;
  const cards = await listPublicTenderCardsByCpv(division, 1);
  if (cards.length === 0) return { title: "Категорія не знайдена" };
  const name = cpvDivisionName(division) ?? `Категорія CPV ${division}`;
  return {
    title: `${name} — тендери Prozorro`,
    description: `Закупівлі Prozorro у категорії «${name}»: оцінка готовності, ризики та документи по кожному тендеру.`,
    alternates: { canonical: `/tendery/${division}` },
  };
}

export default async function TenderyDivisionPage({ params }: { params: Promise<{ division: string }> }) {
  const { division } = await params;
  const classes = await listTenderClasses(division, 3, 100);
  const name = cpvDivisionName(division) ?? `Категорія CPV ${division}`;

  if (classes.length > 0) {
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
            <span className="section-kicker">Категорія CPV {division}</span>
            <h1>{name}</h1>
            <p>Підкатегорії закупівель Prozorro з попередньою оцінкою готовності.</p>
            <div className="guide-grid">
              {classes.map((item, index) => (
                <Link key={item.cls} href={`/tendery/${division}/${item.cls}`} data-reveal data-spot style={{ "--reveal-delay": `${index * 40}ms` } as React.CSSProperties}>
                  <span className="mono">CPV {item.cls}</span>
                  <small>{item.count} {item.count === 1 ? "закупівля" : item.count < 5 ? "закупівлі" : "закупівель"}</small>
                  <h2>{cpvClassName(item.cls) ?? `Категорія ${item.cls}`}</h2>
                  <p>Оцінка go/no-go, ризики та документи по закупівлях.</p>
                  <div>Переглянути <ArrowUpRight size={16} /></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const cards = await listPublicTenderCardsByCpv(division, 200);
  if (cards.length === 0) notFound();
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
          <span className="section-kicker">Категорія CPV {division}</span>
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
