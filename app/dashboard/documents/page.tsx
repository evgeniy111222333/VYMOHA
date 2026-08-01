import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { DocumentLibrary } from "@/components/dashboard/DocumentLibrary";
import { DocumentUploader } from "@/components/dashboard/DocumentUploader";
import { listDocuments } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";
export default async function DocumentsPage() { const user = await requireChatGPTUser("/dashboard/documents"); const documents = await listDocuments(user.userId); return <><div className="dashboard-heading"><div><span className="section-kicker">Документи</span><h1>Бібліотека доказів.</h1><p>Зберігайте типові сертифікати й довідки окремо від публічних даних тендера.</p></div></div><DocumentUploader /><section className="dashboard-card dashboard-card--table"><div className="dashboard-card__heading"><div><span>{documents.length}</span><h2>Файли</h2></div></div><DocumentLibrary initialDocuments={documents} /></section></>; }
