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
  const isWelcomeBonus = account.creditBalance === 30 && account.totalCreditsPurchased === 0 && account.role !== "admin";
  
  return <>{isWelcomeBonus && <div className="welcome-banner" data-reveal>
    <strong>🎉 Вітаємо у Vymoha!</strong>
    <p>Ми нарахували вам <b>30 безкоштовних сигналів</b>. Цього вистачить на 1 експертний або 2 поглиблені аналізи. Завантажте свій перший тендер просто зараз!</p>
    <Link href="/analyze" className="button button--primary">Зробити перший аналіз</Link>
  </div>}<div className="dashboard-heading" data-reveal><div><span className="section-kicker">Огляд</span><h1>Добрий день, {firstName(user.displayName)}.</h1><p>Командний центр рішень: баланс, ризики й тендери, які справді варті часу.</p></div><Link href="/analyze" className="button button--primary">Новий аналіз <ArrowRight size={16} /></Link></div><div className="stat-grid"><Stat icon={Coins} label="Сигнали" value={String(account.creditBalance)} note="для глибоких аналізів" index={0} /><Stat icon={SearchCheck} label="Перевірок" value={String(analyses.length)} note="у цьому просторі" index={1} /><Stat icon={Target} label="Середня оцінка" value={analyses.length ? `${average}/100` : "—"} note="за останні звіти" index={2} /><Stat icon={FileWarning} label="Потребують уваги" value={String(analyses.filter((item) => item.verdict !== "go").length)} note="maybe або no-go" index={3} /><Stat icon={Clock3} label="Дедлайн цього тижня" value={String(analyses.filter((item) => item.deadline && new Date(item.deadline).getTime() - now < 604_800_000).length)} note="активні перевірки" index={4} /></div>      <section className="dashboard-card dashboard-card--table" data-reveal>
        <div className="dashboard-card__heading">
          <div className="dashboard-card__heading-main">
            <span className="dashboard-card__kicker">Історія закупівель</span>
            <h2>Останні перевірки</h2>
          </div>
          <Link href="/dashboard/tenders" className="dashboard-card__action-link">
            Усі перевірки <ArrowRight size={14} />
          </Link>
        </div>
        {analyses.length ? (
          <div className="dashboard-table">
            {analyses.map((item) => (
              <Link href={`/dashboard/tenders/${item.id}`} key={item.id}>
                <span className={`score-chip score-chip--${item.verdict}`}>{item.score}</span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.tenderExternalId} · {item.buyer}</small>
                </span>
                <i>{item.verdict === "go" ? "можна заходити" : item.verdict === "maybe" ? "перевірити" : "не заходити"}</i>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchCheck size={30} />
            <h3>Поки немає перевірок</h3>
            <p>Запустіть перший аналіз — він автоматично збережеться тут.</p>
            <Link className="button button--dark" href="/analyze">Перевірити тендер</Link>
          </div>
        )}
      </section></>;
}

function Stat({ icon: Icon, label, value, note, index }: { icon: typeof SearchCheck; label: string; value: string; note: string; index: number }) { return <article className="stat-card" data-reveal data-spot style={{ "--reveal-delay": `${index * 60}ms` } as React.CSSProperties}><div><Icon size={18} /><span>{label}</span></div><strong>{value}</strong><small>{note}</small></article>; }
function firstName(value: string): string { return value.split(/[\s@]/)[0] || "колего"; }
