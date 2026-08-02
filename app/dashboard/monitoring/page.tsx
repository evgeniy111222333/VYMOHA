import { BellRing, Radar } from "lucide-react";
import Link from "next/link";
import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { listWatches } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";
export default async function MonitoringPage() {
  const user = await requireChatGPTUser("/dashboard/monitoring"); const watches = await listWatches(user.userId);
  return <><div className="dashboard-heading"><div><span className="section-kicker">Моніторинг</span><h1>Зміни не пройдуть повз.</h1><p>Відстежуйте редакції та статуси закупівель, які вже пройшли перевірку.</p></div></div><section className="dashboard-card dashboard-card--table"><div className="dashboard-card__heading"><div><span>{watches.length}</span><h2>Активні спостереження</h2></div></div>{watches.length ? <div className="watch-list">{watches.map((watch) => <div key={watch.id}><span className="watch-list__icon"><Radar size={18} /></span><span><b>{watch.tenderExternalId}</b><small>{watch.lastModified ? `Остання редакція ${new Intl.DateTimeFormat("uk-UA").format(new Date(watch.lastModified))}` : "Очікуємо першу перевірку"}</small></span><i>{watch.active ? "стежимо" : "призупинено"}</i></div>)}</div> : <div className="empty-state"><BellRing size={30} /><h3>Немає активних спостережень</h3><p>Увімкніть моніторинг у результаті будь-якого аналізу.</p><Link href="/analyze" className="button button--dark">Знайти тендер</Link></div>}</section></>;
}
