import { ShieldCheck } from "lucide-react";
import { requireChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";
export default async function SettingsPage() { const user = await requireChatGPTUser("/dashboard/settings"); return <><div className="dashboard-heading"><div><span className="section-kicker">Налаштування</span><h1>Доступ і приватність.</h1><p>Обліковий запис прив’язаний до вашої підтвердженої сесії.</p></div></div><section className="dashboard-card settings-card"><div><span className="settings-card__icon"><ShieldCheck size={22} /></span><div><h2>Захищений вхід</h2><p>Особисті аналізи, профіль і документи доступні лише користувачу <b>{user.email}</b>.</p></div></div><dl><div><dt>Ідентифікатор</dt><dd className="mono">{user.userId.slice(0, 8)}…</dd></div><div><dt>Сесія</dt><dd>активна</dd></div><div><dt>Зберігання документів</dt><dd>приватне об’єктне сховище</dd></div></dl></section></>; }
