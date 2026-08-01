import { ArrowDownRight, Check, CircleDollarSign, FileSearch2, Radar, ShieldCheck, Sparkles } from "lucide-react";

export function Hero() {
  return <section className="hero hero-v3">
    <div className="hero-v3__glow" aria-hidden="true" />
    <div className="container hero-v3__grid">
      <div className="hero-v3__copy" data-reveal>
        <div className="hero-v3__eyebrow"><span>AI tender operating system</span><i>Ukraine / 2026</i></div>
        <h1><span>300 сторінок.</span><span>7 хвилин.</span><em>Одне рішення.</em></h1>
        <p>Вимога читає документацію, зіставляє її з профілем компанії та перетворює тендер на доказовий план: <b>входити, уточнювати чи відмовитися.</b></p>
        <div className="hero-v3__actions"><a className="button button--primary" href="#analyze">Запустити аналіз <ArrowDownRight size={18} /></a><a className="hero-v3__link" href="#product">Подивитися систему <span>↘</span></a></div>
        <div className="hero-v3__proof"><span><ShieldCheck size={14} /> Серверний OpenAI API</span><span><CircleDollarSign size={14} /> Оплата кредитами</span><span><FileSearch2 size={14} /> Докази з PDF</span></div>
      </div>

      <div className="command-center" data-reveal aria-label="Приклад командного центру аналізу">
        <div className="command-center__chrome"><span><i /><i /><i /></span><code>vymoha / intelligence / UA-2026-08-01</code><b>LIVE</b></div>
        <div className="command-center__body">
          <aside className="command-rail"><span className="is-active"><Radar size={17} /></span><span><FileSearch2 size={17} /></span><span><Sparkles size={17} /></span><i /></aside>
          <div className="command-main">
            <div className="command-tender"><div><small>UA-2026-08-01-000507-a</small><h2>Провід та кабель для військової частини</h2><p>ВІЙСЬКОВА ЧАСТИНА 2382 · 128 178 ₴</p></div><span>до 10 серпня</span></div>
            <div className="command-score-row"><div className="command-score"><strong>69</strong><span>/100</span></div><div><small>РІШЕННЯ</small><b>ПОТРІБНА ПЕРЕВІРКА</b><p>2 блокери · 9 відкритих вимог</p></div><div className="command-confidence"><small>ДОКАЗОВІСТЬ</small><strong>78%</strong><i><span /></i></div></div>
            <div className="command-pipeline"><header><span>AI PIPELINE</span><b>04:18 / 07:00</b></header><div className="pipeline-steps"><span className="is-done"><Check size={12} /> Prozorro</span><span className="is-done"><Check size={12} /> 2 файли</span><span className="is-running"><Sparkles size={12} /> Вимоги</span><span>Рішення</span></div></div>
            <div className="command-risk-list">
              <div><i className="risk-signal risk-signal--red" /><span><b>Профіль постачальника не зіставлено</b><small>Відсутні CPV та підтверджений досвід</small></span><em>HIGH</em></div>
              <div><i className="risk-signal risk-signal--amber" /><span><b>Додаток 2 потребує доказу</b><small>Аналогічний договір · стор. 6</small></span><em>REVIEW</em></div>
              <div><i className="risk-signal risk-signal--green" /><span><b>Строк подання активний</b><small>Залишилось 8 днів</small></span><em>READY</em></div>
            </div>
            <footer><span><Sparkles size={13} /> GPT-5.6 · evidence mode</span><b>30 credits</b></footer>
          </div>
        </div>
      </div>
    </div>
    <div className="hero-v3__metrics"><div className="container"><span><b>3×</b> рівні аналізу</span><span><b>32</b> типи вимог</span><span><b>100%</b> серверні секрети</span><span><b>0</b> списань при помилці</span></div></div>
  </section>;
}
