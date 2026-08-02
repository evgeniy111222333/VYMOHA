import { notFound } from "next/navigation";
import Link from "next/link";
import { BookmarkCheck, RotateCw } from "lucide-react";
import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { getAnalysisById, getLatestAnalysisByTender } from "@/src/infrastructure/storage/repository";
import { AnalysisResult } from "@/components/analyzer/AnalysisResult";
import { ScoreExplanation } from "@/components/analyzer/ScoreExplanation";
import { BuyerContextCard } from "@/components/analyzer/BuyerContextCard";
import { TenderDocumentList } from "@/components/analyzer/TenderDocumentList";

export const dynamic = "force-dynamic";

export default async function SavedTenderReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireChatGPTUser("/dashboard/tenders");
  const { id } = await params;

  let analysis = await getAnalysisById(user.userId, id);
  if (!analysis) {
    analysis = await getLatestAnalysisByTender(user.userId, id);
  }

  if (!analysis) {
    notFound();
  }

  const tierLabel = analysis.analysisTier === "expert" ? "Експертний аналіз" : analysis.analysisTier === "deep" ? "Поглиблений аналіз" : "Швидка перевірка";

  return (
    <div className="saved-report-view">
      <header className="saved-report-banner">
        <div className="saved-report-banner__info">
          <span className="saved-report-banner__tag">
            <BookmarkCheck size={13} /> Збережений звіт у кабінеті
          </span>
          <p>
            Дата аналізу: <b>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analysis.generatedAt))}</b>
            {" · "}
            Режим: <b>{tierLabel}</b>
          </p>
        </div>

        <Link
          href={`/analyze?source=${encodeURIComponent(analysis.tender.externalId)}`}
          className="button button--small button--dark"
          title="Запустити новий аналіз за цим тендером"
        >
          <RotateCw size={14} /> Перезапустити аналіз
        </Link>
      </header>

      <AnalysisResult analysis={analysis} signedIn={true} />

      <div className="analysis-context-grid">
        <ScoreExplanation analysis={analysis} />
        {analysis.buyerContext && <BuyerContextCard context={analysis.buyerContext} />}
      </div>

      <TenderDocumentList analysis={analysis} />
    </div>
  );
}
