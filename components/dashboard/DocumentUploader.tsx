"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, LoaderCircle, UploadCloud } from "lucide-react";

export function DocumentUploader() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null); const [status, setStatus] = useState(""); const [loading, setLoading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return; setLoading(true); setStatus(""); const body = new FormData(); body.set("file", file);
    const response = await fetch("/api/documents", { method: "POST", body });
    const payload = await response.json() as { data?: { name: string }; error?: { message?: string } };
    setLoading(false); setStatus(response.ok ? `${payload.data?.name ?? file.name} збережено` : payload.error?.message ?? "Помилка завантаження");
    if (response.ok) { if (ref.current) ref.current.value = ""; window.setTimeout(() => router.refresh(), 450); }
  }
  return <div className="document-uploader"><input ref={ref} type="file" accept=".pdf,.docx,.xlsx,.txt,.csv" onChange={(e) => upload(e.target.files?.[0])} hidden /><button type="button" onClick={() => ref.current?.click()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={24} /> : <UploadCloud size={24} />}<span><b>{loading ? "Завантажуємо…" : "Додати документ"}</b><small>PDF, DOCX, XLSX, TXT або CSV · до 12 МБ</small></span></button>{status && <p><FileCheck2 size={15} />{status}</p>}</div>;
}
