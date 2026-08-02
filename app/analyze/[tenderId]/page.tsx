import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ExternalLink, FileText, Gauge, LockKeyhole, ScanSearch, ShieldAlert } from "lucide-react";
import { getAuthUser, signInPath, safeReturnPath } from "@/app/auth";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { fetchTender, TenderNotFoundError, extractTenderReference } from "@/src/infrastructure/prozorro/client";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";
import { getPublicTenderSummary, isPublicSummaryFresh, upsertPublicTenderSummary } from "@/src/infrastructure/storage/repository";
import { BuyerContextCard } from "@/components/analyzer/BuyerContextCard";
import { ScoreExplanation } from "@/components/analyzer/ScoreExplanation";
import { TenderDocumentList } from "@/components/analyzer/TenderDocumentList";
import type { TenderAnalysis } from "@/src/domain/tender/types";

export const dynamic = "force-dynamic";

const TENDER_ID_PATTERN = /UA-\d{4}-\d{2}-\d{2}-\d{6}(?:-[a-z])?/i;

const verdictLabels = { go: "Можна заходити", maybe: "Потрібна перевірка", "no-go": "Не заходити" } as const;

function isValidTenderId(value: string): boolean {
  return TENDER_ID_PATTERN.test(value);
}

async function loadPublicAnalysis(externalId: string): Promise<{ analysis: TenderAnalysis; cached: boolean } | null> {
  const cached = await getPublicTenderSummary(externalId);
  if (cached) {
    const fresh = await isPublicSummaryFresh(cached, cached.tenderDateModified);
    if (fresh) {
      try {
        const parsed = JSON.parse(cached.resultJson) as TenderAnalysis;
        return { analysis: parsed, cached: true };
      } catch {
        // fall through to recompute
      }
    }
  }

  let tender;
  try { tender = await fetchTender(externalId); } catch (error) {
    if (error instanceof TenderNotFoundError) return null;
    throw error;
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
  if (!loaded) return { title: "Закупівля не знайдена · Vymoha" };
  const tender = loaded.analysis.tender;
  const description = `${verdictLabels[loaded.analysis.verdict]} · бал ${loaded.analysis.score}/100 · ${tender.buyer}. ${loaded.analysis.summary.slice(0, 140)}`;
  return {
    title: `${tender.title} · Vymoha`,
    description,
    alternates: { canonical: `/analyze/${tenderId.toUpperCase()}` },
    openGraph: {
      title: `${tender.title} — попереднє рішення Vymoha`,
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

  return (
    <main className="public-analyze">
      <SiteHeader />
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

        <section className="public-analyze__summary">
          <div className={`public-score public-score--${analysis.verdict}`}>
            <strong>{analysis.score}</strong>
            <span>/100</span>
            <small>{verdictLabels[analysis.verdict]}</small>
          </div>
          <div className="public-analyze__facts">
            <span><small>Бюджет</small><b>{amount}</b></span>
            <span><small>Дедлайн</small><b>{tender.deadline ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(tender.deadline)) : "не вказано"}</b></span>
            <span><small>CPV</small><b>{tender.cpvCode ?? "—"}</b></span>
            <span><small>Документів</small><b>{tender.documents.filter((doc) => doc.title.toLowerCase() !== "sign.p7s").length}</b></span>
          </div>
          <p className="public-analyze__lede">{analysis.summary}</p>
        </section>

        <div className="public-analyze__grid">
          <ScoreExplanation analysis={analysis} />
          {analysis.buyerContext && <BuyerContextCard context={analysis.buyerContext} />}
        </div>

        <TenderDocumentList analysis={analysis} />

        <section className="public-analyze__cta" aria-label="Перейти до повного аналізу">
          <div>
            <span className="section-kicker">Потрібно більше?</span>
            <h2>Швидка перевірка — це фільтр. <em>Для рішення потрібен повний аналіз.</em></h2>

            <p>Поглиблений рівень прочитає до 5 PDF-файлів, складе матрицю вимог з посиланнями на сторінки, підготує питання замовнику та оцінить ризики дискваліфікації.</p>
            <ul>
              <li><ScanSearch size={16} /> Розбір тендерної документації з цитатами</li>
              <li><FileText size={16} /> Матриця вимог і ризиків за категоріями</li>
              <li><ShieldAlert size={16} /> Чорновий запит на роз&rsquo;яснення замовнику</li>
            </ul>
          </div>
          <div className="public-analyze__cta-card">
            <small>12 сигналів</small>
            <strong>≈ 1 240 грн / аналіз</strong>
            <a className="button button--primary button--full" href={deepCtaHref}>
              {user ? <ScanSearch size={17} /> : <LockKeyhole size={17} />} {deepCtaLabel}
            </a>
            <small className="public-analyze__cta-note">Аналіз виконується в межах поточного тендера. Кредити не списуються до завершення звіту.</small>
          </div>
        </section>

        <details className="public-analyze__details">
          <summary>
            <span><Gauge size={16} /> Як рахується бал</span>
            <ChevronDown size={16} />
          </summary>
          <p>Швидка перевірка — детерміністична евристика на основі відкритих даних Prozorro. Враховує статус процедури, дедлайн, наявність тендерного забезпечення, обсяг документів, кваліфікаційні критерії та історію замовника (відхилення, середня кількість учасників). Бал не перевищує 69 без підтвердженого профілю компанії. <Link href="/guides/yakyi-rivn-detalizatsii-vam-pidkhodyt">Детальніше про рівні аналізу</Link>.</p>
        </details>

        <p className="public-analyze__disclaimer">{analysis.disclaimer}</p>
      </article>
      <SiteFooter />
    </main>
  );
}
