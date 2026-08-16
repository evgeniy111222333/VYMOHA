import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { formatGuideDate, getGuide, guides } from "@/src/content/guides";
import { SITE_ORIGIN } from "@/src/lib/seo";

export function generateStaticParams() { return guides.map((guide) => ({ slug: guide.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const guide = getGuide((await params).slug); if (!guide) return {}; return { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } }; }
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const guideUrl = `${SITE_ORIGIN}/guides/${guide.slug}`;
  return (
    <main>
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.updated,
        dateModified: guide.updated,
        inLanguage: "uk-UA",
        url: guideUrl,
        author: { "@type": "Organization", name: "Вимога", url: SITE_ORIGIN },
        publisher: { "@type": "Organization", name: "Вимога", url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/brand-mark-v2.png` },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "База знань", item: `${SITE_ORIGIN}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title },
        ],
      }} />
      <article className="guide-page">
        <header className="container guide-page__header">
          <span className="section-kicker">{guide.eyebrow}</span>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
          <div><span>Оновлено {formatGuideDate(guide.updated)}</span><span>{guide.readTime} читання</span></div>
        </header>
        <div className="container guide-page__layout">
          <nav>
            <span>У матеріалі</span>
            {guide.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{index + 1}. {section.title}</a>)}
            <Link href="/analyze" className="button button--dark">Перевірити тендер</Link>
          </nav>
          <div className="guide-page__content">
            {guide.sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title}>
                <small className="mono">0{index + 1}</small>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.checklist && <ul>{section.checklist.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>}
              </section>
            ))}
            <aside>Матеріал має інформаційний характер. Для спірних або дорогих закупівель залучіть фахівця з публічних закупівель.</aside>
          </div>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}