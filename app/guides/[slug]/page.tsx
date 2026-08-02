import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getGuide, guides } from "@/src/content/guides";

export function generateStaticParams() { return guides.map((guide) => ({ slug: guide.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const guide = getGuide((await params).slug); if (!guide) return {}; return { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` } }; }
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) { const guide = getGuide((await params).slug); if (!guide) notFound(); return <main><SiteHeader /><article className="guide-page"><header className="container guide-page__header"><span className="section-kicker">{guide.eyebrow}</span><h1>{guide.title}</h1><p>{guide.description}</p><div><span>Оновлено {guide.updated}</span><span>{guide.readTime} читання</span></div></header><div className="container guide-page__layout"><nav><span>У матеріалі</span>{guide.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{index + 1}. {section.title}</a>)}<Link href="/analyze" className="button button--dark">Перевірити тендер</Link></nav><div className="guide-page__content">{guide.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title}><small className="mono">0{index + 1}</small><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.checklist && <ul>{section.checklist.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>}</section>)}<aside>Матеріал має інформаційний характер. Для спірних або дорогих закупівель залучіть фахівця з публічних закупівель.</aside></div></div></article><SiteFooter /></main>; }
