import { ArrowDown, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__copy" data-reveal>
          <div className="eyebrow"><span className="eyebrow__dot" /> Аналіз закупівель Prozorro</div>
          <h1>Тендер вартий<br /><em>вашого часу?</em></h1>
          <p>Вимога знаходить стоп-фактори, документи й дедлайни до того, як команда витратить день на підготовку пропозиції.</p>
          <div className="hero__actions">
            <a className="button button--primary" href="#analyze">Перевірити тендер <ArrowDown size={17} /></a>
            <a className="button button--ghost" href="#product">Подивитися звіт</a>
          </div>
          <div className="hero__trust"><span><ShieldCheck size={15} /> Публічні дані</span><span><FileCheck2 size={15} /> Докази до висновків</span></div>
        </div>

        <div className="hero-report" aria-label="Приклад тендерного звіту" data-reveal>
          <div className="hero-report__top"><span className="mono">UA-2026-07-21-011455-a</span><span className="live-pill">активний</span></div>
          <div className="hero-report__title">Поставка труб для системи водопостачання</div>
          <div className="hero-report__meta"><span>Чернівціводоканал</span><span>1 840 000 ₴</span></div>
          <div className="verdict-card">
            <div className="score-ring"><strong>84</strong><span>/100</span></div>
            <div><small>Попереднє рішення</small><b>МОЖНА ЗАХОДИТИ</b><p>після перевірки 3 умов</p></div>
          </div>
          <div className="evidence-list">
            <div><CheckCircle2 size={18} /><span><b>Строк подання</b><small>до 08 серпня, 18:00</small></span><i>готово</i></div>
            <div><span className="status-dot status-dot--amber" /><span><b>Аналогічний договір</b><small>потрібно підтвердити</small></span><i>перевірити</i></div>
            <div><span className="status-dot status-dot--red" /><span><b>Гарантія 55 200 ₴</b><small>не завантажена у профіль</small></span><i>ризик</i></div>
          </div>
          <div className="hero-report__source"><span>Кожен висновок веде до джерела</span><span>↗ стор. 14</span></div>
        </div>
      </div>
      <div className="hero__ticker" aria-hidden="true"><div className="hero__ticker-track"><TickerGroup /><TickerGroup /></div></div>
    </section>
  );
}

function TickerGroup() { return <div className="hero__ticker-group"><span>ДЕДЛАЙНИ</span><i>◆</i><span>ВИМОГИ</span><i>◆</i><span>РИЗИКИ</span><i>◆</i><span>ДОКАЗИ</span><i>◆</i><span>РІШЕННЯ</span><i>◆</i></div>; }
