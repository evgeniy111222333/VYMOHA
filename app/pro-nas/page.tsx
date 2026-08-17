import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE_ORIGIN } from "@/src/lib/seo";

export const metadata: Metadata = {
  title: "Про сервіс",
  description: "Вимога: сервіс попередньої перевірки закупівель Prozorro. Go/no-go аналіз, ризики та документи з доказами для кожного висновку.",
  alternates: { canonical: "/pro-nas" },
};

export default function ProNasPage() {
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "Про Вимогу",
        url: `${SITE_ORIGIN}/pro-nas`,
        mainEntity: { "@type": "Organization", name: "Вимога", url: SITE_ORIGIN },
      }} />
      <section className="library-page">
        <div className="container">
          <span className="section-kicker">Про сервіс</span>
          <h1>Рішення по тендеру<br />до того, як команда витратила день.</h1>
          <p>Вимога — сервіс попередньої перевірки закупівель Prozorro. Ми перетворюємо номер тендера на доказовий go/no-go звіт: бал, ризики, документи й питання замовнику.</p>
          <div className="guide-grid">
            <div className="term-card">
              <span className="mono">Дані</span>
              <h2>Офіційний Prozorro</h2>
              <p>Кожен висновок прив&rsquo;язаний до відкритих даних системи Prozorro: статус, дедлайни, документи, кваліфікаційні критерії та історія замовника.</p>
            </div>
            <div className="term-card">
              <span className="mono">Метод</span>
              <h2>Прозора евристика + AI</h2>
              <p>Швидка перевірка — детерміністична й безкоштовна. Поглиблений рівень читає документи через AI і будує матрицю вимог з цитатами.</p>
            </div>
            <div className="term-card">
              <span className="mono">Чесність</span>
              <h2>Невизначеність позначена</h2>
              <p>Система показує рівень упевненості та прогалини. Без вигаданої точності — кожен суттєвий висновок має джерело.</p>
            </div>
          </div>
          <p style={{ marginTop: 40, maxWidth: 620, color: "var(--muted)" }}>Сервіс є допоміжним інструментом і не замінює юридичну перевірку чи рішення відповідальної особи. Для спірних або дорогих закупівель залучіть фахівця з публічних закупівель.</p>
          <div style={{ marginTop: 24 }}>
            <Link href="/analyze" className="button button--dark">Перевірити тендер</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
