import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronDown, ExternalLink, FileText, Gauge, LockKeyhole, ScanSearch, ShieldAlert } from "lucide-react";
import { getAuthUser, signInPath, safeReturnPath } from "@/app/auth";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { simulateActiveScore } from "@/src/domain/tender/scoring";
import { fetchTender, TenderNotFoundError, extractTenderReference } from "@/src/infrastructure/prozorro/client";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";
import { consumeRateLimit, getPublicTenderSummary, isPublicSummaryFresh, upsertPublicTenderSummary } from "@/src/infrastructure/storage/repository";
import { getGuide } from "@/src/content/guides";
import { SITE_ORIGIN } from "@/src/lib/seo";
import { BuyerContextCard } from "@/components/analyzer/BuyerContextCard";
import { PublicTenderHero } from "@/components/analyzer/PublicTenderHero";
import { ScoreExplanation } from "@/components/analyzer/ScoreExplanation";
import { TenderDocumentList } from "@/components/analyzer/TenderDocumentList";
import type { TenderAnalysis } from "@/src/domain/tender/types";

export const dynamic = "force-dynamic";

const TENDER_ID_PATTERN = /UA-\d{4}-\d{2}-\d{2}-\d{6}(?:-[a-z])?/i;

const verdictLabels = { go: "Можна заходити", maybe: "Потрібна перевірка", "no-go": "Не заходити" } as const;

const RELATED_GUIDE_SLUGS: Record<TenderAnalysis["verdict"], string[]> = {
  go: ["dokumenty-dlia-uchasti", "analohichnyi-dohovir"],
  maybe: ["dokumenty-dlia-uchasti", "prychyny-vidkhylennia"],
  "no-go": ["prychyny-vidkhylennia", "dokumenty-dlia-uchasti"],
};

function isValidTenderId(value: string): boolean {
  return TENDER_ID_PATTERN.test(value);
}

async function loadPublicAnalysis(externalId: string): Promise<{ analysis: TenderAnalysis; cached: boolean } | null> {
  const cached = await getPublicTenderSummary(externalId);
  const parseCached = (): { analysis: TenderAnalysis; cached: boolean } | null => {
    if (!cached) return null;
    try {
      return { analysis: JSON.parse(cached.resultJson) as TenderAnalysis, cached: true };
    } catch {
      return null;
    }
  };

  if (cached) {
    const fresh = await isPublicSummaryFresh(cached, cached.tenderDateModified);
    if (fresh) return parseCached();
  }

  // Rate-limit live fetches: масовий краул некешованих/прострочених сторінок
  // не повинен спамити Prozorro. Понад ліміт віддаємо застарілий кеш.
  const liveFetch = await consumeRateLimit("public:live-fetch", 200, 3_600);
  if (!liveFetch.allowed) return parseCached();

  let tender;
  try { tender = await fetchTender(externalId); } catch (error) {
    if (error instanceof TenderNotFoundError) return null;
    // Тимчасовий збій (429/таймаут): віддаємо застарілий кеш замість 500.
    return parseCached();
  }
  const buyerContext = tender.buyerEdrpou ? await fetchBuyerContext(tender.buyerEdrpou) : undefined;
  const analysis = analyzeTender(tender, undefined, new Date(), buyerContext, "quick");
  try { await upsertPublicTenderSummary({ analysis }); } catch (error) { console.error("public summary upsert failed", error); }
  return { analysis, cached: false };
}

export async function generateMetadata({ params }: { params: Promise<{ tenderId: string }> }): Promise<Metadata> {
  const { tenderId } = await params;
  if (!isValidTenderId(tenderId)) return { title: "Закупівля не знайдена" };
  const loaded = await loadPublicAnalysis(tenderId.toUpperCase());
  if (!loaded) return { title: "Закупівля не знайдена" };
  const tender = loaded.analysis.tender;
  const description = `${verdictLabels[loaded.analysis.verdict]} · бал ${loaded.analysis.score}/100 · ${tender.buyer}. ${loaded.analysis.summary.slice(0, 140)}`;
  return {
    title: tender.title,
    description,
    alternates: { canonical: `/analyze/${tenderId.toUpperCase()}` },
    openGraph: {
      title: `${tender.title} | Вимога`,
      description,
      url: `/analyze/${tenderId.toUpperCase()}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: tender.title, description },
  };
}

export default async function PublicTenderPage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  if (!isValidTenderId(tenderId)) notFound();

  const externalId = (() => { try { return extractTenderReference(tenderId); } catch { return null; } })();
  if (!externalId) notFound();

  const loaded = await loadPublicAnalysis(externalId);
  if (!loaded) notFound();
  const { analysis, cached } = loaded;
  const tender = analysis.tender;

  const now = new Date();
  const simulated = simulateActiveScore(tender, now, undefined, analysis.buyerContext, analysis.marketContext);
  const deadlineDate = tender.deadline ? new Date(tender.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate.getTime() < now.getTime() : false;

  const user = await getAuthUser();
  const account = user ? await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName }) : null;
  const hasCredits = (account?.creditBalance ?? 0) >= 12;

  const amount = tender.amount
    ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: tender.currency ?? "UAH", maximumFractionDigits: 0 }).format(tender.amount)
    : "не вказано";

  const deepCtaHref = !user
    ? signInPath(safeReturnPath(`/analyze/${externalId}`))
    : hasCredits
      ? `/analyze?source=${encodeURIComponent(externalId)}&tier=deep`
      : "/dashboard/billing";

  const deepCtaLabel = !user
    ? "Увійти, щоб продовжити"
    : hasCredits
      ? "Запустити поглиблений аналіз"
      : "Купити кредити";

  const relatedGuides = RELATED_GUIDE_SLUGS[analysis.verdict]
    .map((slug) => getGuide(slug))
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));

  return (
    <main className="public-analyze">
      <SiteHeader />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Головна", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Перевірити тендер", item: `${SITE_ORIGIN}/analyze` },
          { "@type": "ListItem", position: 3, name: tender.title },
        ],
      }} />
      <article className="container public-analyze__article">
        <header className="public-analyze__head">
          <div>
            <span className="section-kicker">Публічна стрічка Vymoha</span>
            <h1>{tender.title}</h1>
            <p>
              <span className="mono">{tender.externalId}</span>
              {" · "}
              <span>{tender.buyer}</span>
            </p>
            <p className="public-analyze__meta">
              Бал <b>{analysis.score}/100</b> · упевненість <b>{analysis.confidence}%</b> · {cached ? "кешовано" : "свіжий"} аналіз
            </p>
          </div>
          <a className="button button--ghost" href={tender.sourceUrl} target="_blank" rel="noreferrer">
            Відкрити в Prozorro <ExternalLink size={14} />
          </a>
        </header>

        <PublicTenderHero
          analysis={analysis}
          amountFormatted={amount}
          simulatedScore={simulated.score}
          simulatedVerdict={simulated.verdict}
          simulatedFactors={simulated.factors}
          isExpired={isExpired}
        />

        <div className="public-analyze__grid">
          <ScoreExplanation analysis={analysis} />
          {analysis.buyerContext && <BuyerContextCard context={analysis.buyerContext} />}
        </div>

        <TenderDocumentList analysis={analysis} />

        <section className="public-analyze__cta" aria-label="Перейти до повного аналізу">
          <div>
            <span className="section-kicker">Потрібно більше?</span>
            <h2>Швидка перевірка — це фільтр. <em>Для рішення потрібен повний аналіз.</em></h2>

            <p>Поглиблений рівень прочитає всі файли ТД, складе матрицю кваліфікаційних вимог, знайде приховані ризики та підготує чорновий запит замовнику.</p>
            <ul>
              <li><ScanSearch size={16} /> Розбір тендерної документації з цитатами</li>
              <li><FileText size={16} /> Матриця вимог і ризиків за категоріями</li>
              <li><ShieldAlert size={16} /> Чорновий запит на роз&rsquo;яснення замовнику</li>
            </ul>
          </div>
          <div className="public-analyze__cta-card">
            <small>12 сигналів</small>
            <strong>Пакет «Спроба» — 149 ₴</strong>
            <a className="button button--primary button--full" href={deepCtaHref}>
              {user ? <ScanSearch size={17} /> : <LockKeyhole size={17} />} {deepCtaLabel}
            </a>
            <small className="public-analyze__cta-note">Аналіз виконується в межах поточного тендера. Кредити не списуються до завершення звіту.</small>
          </div>
        </section>

        <details className="public-analyze__details" open>
          <summary>
            <span><Gauge size={16} /> Як рахується бал</span>
            <ChevronDown size={16} />
          </summary>
          <p>Швидка перевірка — детерміністична евристика на основі відкритих даних Prozorro. Враховує статус процедури, дедлайн, наявність тендерного забезпечення, обсяг документів, кваліфікаційні критерії та історію замовника. <Link href="/analyze">Перевірити інший тендер</Link>.</p>
        </details>

        {relatedGuides.length > 0 && (
          <section className="public-analyze__related" aria-label="Матеріали на тему">
            <span className="section-kicker">Матеріали на тему</span>
            <h2>Підготувати пропозицію без відхилення</h2>
            <div>
              {relatedGuides.map((guide) => (
                <a key={guide.slug} className="button button--ghost" href={`/guides/${guide.slug}`}>
                  {guide.title} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="public-analyze__disclaimer">{analysis.disclaimer}</p>
      </article>
      <SiteFooter />
    </main>
  );
}
