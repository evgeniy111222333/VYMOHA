import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { listTenderCpvGroups } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Тендери Prozorro за категоріями",
  description: "Активні та завершені закупівлі Prozorro, згруповані за категоріями CPV: будівництво, продукти, IT, медицина та інші.",
  alternates: { canonical: "/tendery" },
};

export default async function TenderyPage() {
  const groups = await listTenderCpvGroups(60);
  return (
    <main>
      <SiteHeader />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Каталог закупівель</span>
          <h1>Тендери<br />за категоріями.</h1>
          <p>Огляд закупівель Prozorro, згрупованих за CPV-кодами. Зайдіть у категорію, щоб побачити оцінку готовності та ризики по кожному тендеру.</p>
          <div className="guide-grid">
            {groups.map((group, index) => (
              <a key={group.cpv} href={`/tendery/${group.cpv}`} data-reveal data-spot style={{ "--reveal-delay": `${index * 40}ms` } as React.CSSProperties}>
                <span className="mono">{group.cpv}</span>
                <small>{group.count} {group.count === 1 ? "закупівля" : group.count < 5 ? "закупівлі" : "закупівель"}</small>
                <h2>{group.label}</h2>
                <p>Оцінка go/no-go, ризики та документи по закупівлях цієї категорії.</p>
                <div>Переглянути <ArrowUpRight size={16} /></div>
              </a>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
