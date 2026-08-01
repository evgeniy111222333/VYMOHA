import { BarChart3 } from "lucide-react";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { listAnalyses } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  const user = await requireChatGPTUser("/dashboard/analytics"); const analyses = await listAnalyses(user.userId, 50);
  const buckets = [
    { label: "Можна заходити", value: analyses.filter((item) => item.verdict === "go").length, className: "bar--green" },
    { label: "Потрібна перевірка", value: analyses.filter((item) => item.verdict === "maybe").length, className: "bar--amber" },
    { label: "Не заходити", value: analyses.filter((item) => item.verdict === "no-go").length, className: "bar--red" },
  ];
  const max = Math.max(1, ...buckets.map((item) => item.value));
  return <><div className="dashboard-heading"><div><span className="section-kicker">Аналітика</span><h1>Якість воронки.</h1><p>Подивіться, скільки закупівель команда відсіює до дорогої підготовки.</p></div></div><div className="analytics-grid"><section className="dashboard-card"><div className="dashboard-card__heading"><div><span>Розподіл</span><h2>Go / no-go</h2></div></div><div className="bar-chart">{buckets.map((bucket) => <div key={bucket.label}><span>{bucket.label}</span><div><i className={bucket.className} style={{ width: `${Math.max(bucket.value ? 12 : 0, (bucket.value / max) * 100)}%` }} /></div><b>{bucket.value}</b></div>)}</div></section><section className="dashboard-card analytics-insight"><BarChart3 size={25} /><span>Інсайт</span><h2>{analyses.length ? `${Math.round((analyses.filter((item) => item.verdict === "no-go").length / analyses.length) * 100)}% перевірок зупинено до підготовки.` : "Дані з’являться після перших перевірок."}</h2><p>Цей показник перетворює зекономлений час на вимірюваний результат.</p></section></div></>;
}
