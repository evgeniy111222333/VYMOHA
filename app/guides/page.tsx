import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { guides } from "@/src/content/guides";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "База знань про тендери Prozorro", description: "Практичні інструкції для постачальників: документи, вимоги, відхилення та перевірка тендерної пропозиції.", alternates: { canonical: "/guides" } };
export default function GuidesPage() { return <main><SiteHeader /><section className="library-page"><div className="container"><span className="section-kicker">База знань</span><h1>Менше теорії.<br />Більше перевірних дій.</h1><p>Матеріали для учасників закупівель, побудовані навколо реальних рішень і стоп-факторів.</p><div className="guide-grid">{guides.map((guide, index) => <a key={guide.slug} href={`/guides/${guide.slug}`} data-reveal data-spot style={{ "--reveal-delay": `${index * 70}ms` } as React.CSSProperties}><span className="mono">0{index + 1}</span><small>{guide.eyebrow}</small><h2>{guide.title}</h2><p>{guide.description}</p><div>{guide.readTime}<ArrowUpRight size={16} /></div></a>)}</div></div></section><SiteFooter /></main>; }
