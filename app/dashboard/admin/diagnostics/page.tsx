import { Activity, ShieldCheck } from "lucide-react";
import { requireAuthUser } from "@/app/auth";
import { AdminDiagnostics } from "@/components/dashboard/AdminDiagnostics";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { requireAdmin } from "@/src/infrastructure/storage/admin";
import { listAnalysisTelemetry } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosticsPage() {
  const user = await requireAuthUser("/dashboard/admin/diagnostics");
  await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName });
  await requireAdmin(user.userId);
  const entries = await listAnalysisTelemetry(100);
  return <><div className="dashboard-heading"><div><span className="section-kicker">Адміністрування · приватно</span><h1>Надійність аналізів.</h1><p>Операційні метрики для діагностики без збереження змісту тендерів або даних запитів.</p></div><div className="admin-badge"><ShieldCheck size={18} /> Admin control</div></div><div className="diagnostics-heading"><Activity size={18} /><span>Доступ фіксується в журналі аудиту</span></div><AdminDiagnostics entries={entries} /></>;
}
