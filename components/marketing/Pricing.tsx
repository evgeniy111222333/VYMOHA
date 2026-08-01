import { ArrowUpRight, Check, Coins, Sparkles } from "lucide-react";
import { CREDIT_PACKAGES } from "@/src/domain/billing/packages";

export function Pricing() {
  return (
    <section className="pricing pricing-v3" id="pricing">
      <div className="container">
        <div className="editorial-heading" data-reveal>
          <span className="section-index">03 / PLANS</span>
          <h2>Почніть безплатно.<br /><em>Обирайте глибину за потреби.</em></h2>
          <p>Швидка перевірка доступна без оплати. Кредити потрібні лише для детального читання документів і персонального висновку.</p>
        </div>
        <div className="pricing-v3__calculator" data-reveal>
          <div><Coins size={19} /><span><small>Поглиблений</small><b>30 cr</b></span></div>
          <i>або</i>
          <div><Sparkles size={19} /><span><small>Експертний</small><b>65 cr</b></span></div>
          <p>Безплатний рівень — для швидкого первинного відбору.</p>
        </div>
        <div className="pricing-grid pricing-grid-v3">
          {CREDIT_PACKAGES.map((pack) => (
            <article key={pack.id} className={pack.popular ? "price-card price-card--featured" : "price-card"} data-reveal>
              {pack.popular && <span className="price-card__label">Найкраща точка входу</span>}
              <header><span>{pack.name}</span><Coins size={18} /></header>
              <div className="price-card__credits"><strong>{pack.credits}</strong><i>кредитів</i></div>
              <div className="price-card__price"><b>{(pack.amountMinor / 100).toLocaleString("uk-UA")} ₴</b><span>одноразово</span></div>
              <p>{pack.description}</p>
              <ul>
                <li><Check size={15} /> Не мають строку дії</li>
                <li><Check size={15} /> Звіти з доказами</li>
                <li><Check size={15} /> Історія перевірок</li>
              </ul>
              <a href="/dashboard/billing" className={pack.popular ? "button button--light" : "button button--outline"}>Обрати пакет <ArrowUpRight size={15} /></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
