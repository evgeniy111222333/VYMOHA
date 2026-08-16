import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { cpvDivisionName } from "@/src/content/cpv";
import { listTenderDivisions } from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Тендери Prozorro за категоріями",
  description: "Закупівлі Prozorro за категоріями: будівельні роботи, продукти харчування, медицина, IT, транспорт та інші. Оцінка готовності та ризики по кожному тендеру.",
  alternates: { canonical: "/tendery" },
};

export default async function TenderyPage() {
  const divisions = await listTenderDivisions(60);
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Тендери", item: `${SITE_ORIGIN}/tendery` },
        ],
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Каталог закупівель</span>
          <h1>Тендери<br />за категоріями.</h1>
          <p>Закупівлі Prozorro, згруповані за напрямами. Зайдіть у категорію, щоб побачити оцінку готовності та ризики по кожному тендеру.</p>
          <div className="guide-grid">
            {divisions.map((division, index) => {
              const name = cpvDivisionName(division.division) ?? `Категорія ${division.division}`;
              return (
                <a key={division.division} href={`/tendery/${division.division}`} data-reveal data-spot style={{ "--reveal-delay": `${index * 40}ms` } as React.CSSProperties}>
                  <span className="mono">CPV {division.division}</span>
                  <small>{division.count} {division.count === 1 ? "закупівля" : division.count < 5 ? "закупівлі" : "закупівель"}</small>
                  <h2>{name}</h2>
                  <p>Оцінка go/no-go, ризики та документи по закупівлях цієї категорії.</p>
                  <div>Переглянути <ArrowUpRight size={16} /></div>
                </a>
              );
            })}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
