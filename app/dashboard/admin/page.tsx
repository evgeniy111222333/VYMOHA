import { notFound } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { AdminUsers } from "@/components/dashboard/AdminUsers";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { listUserAccounts, requireAdmin } from "@/src/infrastructure/storage/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/dashboard/admin");
  await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName });
  
  try {
    await requireAdmin(user.userId);
  } catch {
    notFound();
  }

  const users = await listUserAccounts();
  return <><div className="dashboard-heading"><div><span className="section-kicker">Адміністрування</span><h1>Люди, ролі й ліміти.</h1><p>Видавайте статус адміністратора, нараховуйте сигнали та зупиняйте доступ без ручної роботи з базою.</p></div><div className="admin-badge"><ShieldCheck size={18} /> Admin control</div></div><section className="dashboard-card admin-card"><div className="dashboard-card__heading"><div><Users size={18} /><h2>Користувачі</h2></div><span>{users.length} акаунтів</span></div><AdminUsers initialUsers={users} /></section></>;
}
