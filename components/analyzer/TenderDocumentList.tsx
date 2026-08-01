import { ExternalLink, FileText, Info } from "lucide-react";
import type { TenderAnalysis, TenderDocument } from "@/src/domain/tender/types";

export function TenderDocumentList({ analysis }: { analysis: TenderAnalysis }) {
  const documents = analysis.tender.documents.filter((document) => document.title.toLowerCase() !== "sign.p7s");
  if (!documents.length) return null;
  const readsFiles = analysis.mode === "ai-enhanced";

  return (
    <section className="tender-documents" aria-labelledby="tender-documents-title">
      <header>
        <span><FileText size={18} /><b id="tender-documents-title">Файли закупівлі</b></span>
        <small>{documents.length} {fileNoun(documents.length)}</small>
      </header>
      <div className={readsFiles ? "document-scope document-scope--read" : "document-scope"}>
        <Info size={15} />
        <p>{readsFiles
          ? "Поглиблений рівень намагається прочитати доступні файли й показує покриття нижче."
          : "Швидка перевірка не читає вміст файлів. Вона показує назви й метадані — відкрийте оригінали або запустіть поглиблений аналіз."}</p>
      </div>
      <div className="tender-document-list">
        {documents.map((document) => <DocumentLink document={document} key={document.id} />)}
      </div>
    </section>
  );
}

function DocumentLink({ document }: { document: TenderDocument }) {
  const meta = [formatType(document), formatDate(document.dateModified)].filter(Boolean).join(" · ");
  const content = <><span><b>{document.title}</b>{meta && <small>{meta}</small>}</span><ExternalLink size={14} /></>;
  return document.url
    ? <a href={document.url} target="_blank" rel="noreferrer">{content}</a>
    : <div aria-disabled="true">{content}</div>;
}

function formatType(document: TenderDocument): string {
  const value = `${document.format ?? ""} ${document.title}`.toLowerCase();
  if (value.includes("pdf")) return "PDF";
  if (value.includes("word") || value.includes("docx")) return "DOCX";
  if (value.includes("sheet") || value.includes("xlsx")) return "XLSX";
  return "Файл Prozorro";
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(date) : "";
}

function fileNoun(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? "файл" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "файли" : "файлів";
}
