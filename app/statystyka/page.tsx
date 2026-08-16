import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { cpvDivisionName } from "@/src/content/cpv";
import { getMarketOverview, listDistinctBuyers, listTenderDivisions } from "@/src/infrastructure/storage/repository";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Статистика публічних закупівель України",
  description: "Відкриті дані про закупівлі Prozorro: кількість тендерів, середня конкуренція, частка закупівель з одним учасником, топ-напрями та замовники.",
  alternates: { canonical: "/statystyka" },
};

export default async function StatystykaPage() {
  const [overview, divisions, buyers] = await Promise.all([
    getMarketOverview(),
    listTenderDivisions(15),
    listDistinctBuyers(15),
  ]);

  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Статистика публічних закупівель Prozorro",
        description: "Агреговані показники закупівель Prozorro на основі ринкового індексу Вимоги.",
        url: `${SITE_ORIGIN}/statystyka`,
        isAccessibleForFree: true,
        creator: { "@type": "Organization", name: "Вимога", url: SITE_ORIGIN },
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Відкриті дані</span>
          <h1>Статистика<br />публічних закупівель.</h1>
          <p>Агреговані показники ринку Prozorro з ринкового індексу Вимоги: конкуренція, напрями та замовники.</p>

          <div className="guide-grid" style={{ marginTop: 48 }}>
            <div className="term-card">
              <span className="mono">Індекс</span>
              <h2>{overview.totalTenders.toLocaleString("uk-UA")}</h2>
              <p>завершених тендерів проаналізовано в ринковому індексі.</p>
            </div>
            <div className="term-card">
              <span className="mono">Конкуренція</span>
              <h2>{overview.avgParticipants.toFixed(1)}</h2>
              <p>учасників у середньому на одну закупівлю.</p>
            </div>
            <div className="term-card">
              <span className="mono">Один учасник</span>
              <h2>{pct(overview.singleBidderRate)}</h2>
              <p>закупівель мають не більше одного учасника.</p>
            </div>
          </div>

          <div className="guide-grid" style={{ marginTop: 24 }}>
            <div className="term-card">
              <span className="mono">Топ напрямів</span>
              {divisions.slice(0, 8).map((division) => (
                <p key={division.division} style={{ margin: "6px 0" }}>
                  <Link href={`/tendery/${division.division}`} style={{ color: "inherit" }}>
                    {cpvDivisionName(division.division) ?? division.division} — {division.count}
                  </Link>
                </p>
              ))}
            </div>
            <div className="term-card">
              <span className="mono">Топ замовників</span>
              {buyers.slice(0, 8).map((buyer) => (
                <p key={buyer.edrpou} style={{ margin: "6px 0" }}>
                  <Link href={`/zamovnyky/${buyer.edrpou}`} style={{ color: "inherit" }}>
                    {buyer.name} — {buyer.count}
                  </Link>
                </p>
              ))}
            </div>
          </div>

          <p style={{ marginTop: 32, maxWidth: 620, color: "var(--muted)" }}>
            Дані формуються з відкритих даних системи Prozorro та оновлюються автоматично. Показники мають довідковий характер.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
