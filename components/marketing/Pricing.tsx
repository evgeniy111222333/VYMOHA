import { Check } from "lucide-react";

const plans = [
  { name: "Разово", price: "349 ₴", suffix: "за тендер", description: "Коли треба перевірити одну закупівлю прямо зараз.", features: ["Повний структурований аналіз", "Матриця вимог", "PDF-звіт"], cta: "Перевірити тендер" },
  { name: "Команда", price: "1 490 ₴", suffix: "на місяць", description: "Для компаній, які регулярно готують пропозиції.", features: ["10 поглиблених аналізів", "Профіль компанії", "Сховище документів", "Моніторинг змін"], cta: "Почати роботу", featured: true },
  { name: "Партнер", price: "від 3 900 ₴", suffix: "на місяць", description: "Для консультантів і тендерних відділів.", features: ["Кілька компаній", "Спільна робота", "Експорт під вашим брендом", "Пріоритетна підтримка"], cta: "Обговорити умови" },
];

export function Pricing() {
  return (
    <section className="pricing" id="pricing"><div className="container"><div className="section-heading"><div><span className="section-kicker">Тарифи</span><h2>Ціна менша за одну<br />пропущену вимогу.</h2></div><p>Почніть з безплатного звіту. Платіть лише тоді, коли потрібен повний пакет перевірки.</p></div><div className="pricing-grid">{plans.map((plan) => <article key={plan.name} className={plan.featured ? "price-card price-card--featured" : "price-card"}>{plan.featured && <span className="price-card__label">Найкращий старт</span>}<h3>{plan.name}</h3><div className="price-card__price"><b>{plan.price}</b><span>{plan.suffix}</span></div><p>{plan.description}</p><ul>{plan.features.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul><a href="/analyze" className={plan.featured ? "button button--light" : "button button--outline"}>{plan.cta}</a></article>)}</div></div></section>
  );
}
