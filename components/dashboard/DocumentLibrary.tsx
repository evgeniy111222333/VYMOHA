"use client";

import { useState } from "react";
import { Download, FileText, LoaderCircle, Trash2 } from "lucide-react";
import type { StoredDocument } from "@/src/infrastructure/storage/repository";

export function DocumentLibrary({ initialDocuments }: { initialDocuments: StoredDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(id: string) {
    if (!window.confirm("Видалити документ без можливості відновлення?")) return;
    setBusy(id);
    const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setDocuments((items) => items.filter((item) => item.id !== id));
    setBusy(null);
  }
  if (!documents.length) return <div className="empty-state"><FileText size={28} /><h3>Бібліотека порожня</h3><p>Завантажте перший документ за допомогою блоку вище.</p></div>;
  return <div className="document-list">{documents.map((document) => <div key={document.id}><FileText size={19} /><span><b>{document.name}</b><small>{formatBytes(document.sizeBytes)} · {new Intl.DateTimeFormat("uk-UA").format(new Date(document.createdAt))}</small></span><div className="document-actions"><a href={`/api/documents/${encodeURIComponent(document.id)}`} aria-label={`Завантажити ${document.name}`}><Download size={16} /></a><button onClick={() => remove(document.id)} disabled={busy === document.id} aria-label={`Видалити ${document.name}`}>{busy === document.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button></div></div>)}</div>;
}

function formatBytes(bytes: number): string { return bytes < 1_048_576 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1_048_576).toFixed(1)} МБ`; }
