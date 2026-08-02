import { ArrowRight, Clock3, Coins, FileWarning, SearchCheck, Target } from "lucide-react";
import Link from "next/link";
import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { listAnalyses } from "@/src/infrastructure/storage/repository";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { currentTimestamp } from "@/src/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const [analyses, account] = await Promise.all([listAnalyses(user.userId, 6), ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName })]);
  const average = analyses.length ? Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length) : 0;
  const now = currentTimestamp();
  return <><div className="dashboard-heading"><div><span className="section-kicker">Огляд</span><h1>Добрий день, {firstName(user.displayName)}.</h1><p>Командний центр рішень: баланс, ризики й тендери, які справді варті часу.</p></div><Link href="/analyze" className="button button--primary">Новий аналіз <ArrowRight size={16} /></Link></div><div className="stat-grid"><Stat icon={Coins} label="Сигнали" value={String(account.creditBalance)} note="для глибоких аналізів" /><Stat icon={SearchCheck} label="Перевірок" value={String(analyses.length)} note="у цьому просторі" /><Stat icon={Target} label="Середня оцінка" value={analyses.length ? `${average}/100` : "—"} note="за останні звіти" /><Stat icon={FileWarning} label="Потребують уваги" value={String(analyses.filter((item) => item.verdict !== "go").length)} note="maybe або no-go" /><Stat icon={Clock3} label="Дедлайн цього тижня" value={String(analyses.filter((item) => item.deadline && new Date(item.deadline).getTime() - now < 604_800_000).length)} note="активні перевірки" /></div><section className="dashboard-card dashboard-card--table"><div className="dashboard-card__heading"><div><span>Останні</span><h2>Перевірки</h2></div><Link href="/dashboard/tenders">Усі перевірки →</Link></div>{analyses.length ? <div className="dashboard-table">{analyses.map((item) => <Link href={`/analyze?source=${encodeURIComponent(item.tenderExternalId)}`} key={item.id}><span className={`score-chip score-chip--${item.verdict}`}>{item.score}</span><span><b>{item.title}</b><small>{item.tenderExternalId} · {item.buyer}</small></span><i>{item.verdict === "go" ? "можна заходити" : item.verdict === "maybe" ? "перевірити" : "не заходити"}</i><ArrowRight size={16} /></Link>)}</div> : <div className="empty-state"><SearchCheck size={30} /><h3>Поки немає перевірок</h3><p>Запустіть перший аналіз — він автоматично збережеться тут.</p><Link className="button button--dark" href="/analyze">Перевірити тендер</Link></div>}</section></>;
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof SearchCheck; label: string; value: string; note: string }) { return <article className="stat-card"><div><Icon size={18} /><span>{label}</span></div><strong>{value}</strong><small>{note}</small></article>; }
function firstName(value: string): string { return value.split(/[\s@]/)[0] || "колего"; }
