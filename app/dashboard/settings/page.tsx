import { BadgeCheck, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { requireAuthUser } from "@/app/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAuthUser("/dashboard/settings");
  const primaryIdentity = user.phone ?? user.email;
  return <><div className="dashboard-heading"><div><span className="section-kicker">Налаштування</span><h1>Доступ і приватність.</h1><p>Власний обліковий запис Вимоги, активна сесія та перевірені способи входу.</p></div></div><section className="dashboard-card settings-card"><div><span className="settings-card__icon"><ShieldCheck size={22} /></span><div><h2>Захищений вхід</h2><p>Особисті аналізи, профіль і документи доступні лише після входу як <b>{primaryIdentity}</b>.</p></div></div><dl><div><dt>Ідентифікатор</dt><dd className="mono">{user.userId.slice(0, 8)}…</dd></div><div><dt>Сесія</dt><dd><BadgeCheck size={14} /> активна</dd></div><div><dt>Пошта</dt><dd>{user.email.endsWith(".invalid") ? "не додана" : user.email}</dd></div><div><dt>Телефон</dt><dd><Smartphone size={14} /> {user.phone ?? "не доданий"}</dd></div><div><dt>Захист пароля</dt><dd><KeyRound size={14} /> PBKDF2-SHA256</dd></div><div><dt>Зберігання документів</dt><dd>приватне об’єктне сховище</dd></div></dl></section></>;
}
