import { ArrowUpRight, FileWarning, ScanSearch, TimerReset } from "lucide-react";

const steps = [
  { n: "01", title: "Забирає дані з Prozorro", text: "Реквізити, дедлайн, файли, критерії, забезпечення та всі актуальні редакції.", icon: ScanSearch },
  { n: "02", title: "Розкладає вимоги", text: "Формальні, технічні, фінансові та досвідні умови стають перевірним списком.", icon: FileWarning },
  { n: "03", title: "Дає рішення", text: "Go / Maybe / No-go, пріоритетні ризики й наступні дії — без юридичного туману.", icon: TimerReset },
];

export function ProductProof() {
  return (
    <section className="product-proof" id="product">
      <div className="container">
        <div className="section-heading"><div><span className="section-kicker">Як працює</span><h2>Від посилання до рішення<br />за один робочий екран.</h2></div><p>Ми не приховуємо висновок за «магічним AI». Кожен ризик має джерело, статус і наступну дію.</p></div>
        <div className="step-grid">
          {steps.map((step) => <article key={step.n} className="step-card"><div className="step-card__top"><span>{step.n}</span><step.icon size={22} /></div><h3>{step.title}</h3><p>{step.text}</p><a href="/analyze">Спробувати <ArrowUpRight size={15} /></a></article>)}
        </div>
        <div className="proof-panel">
          <div className="proof-panel__rail"><span>ВИСНОВОК</span><b>Потрібна дія</b><span>Доказ</span><span>Власник</span></div>
          <div className="proof-panel__body">
            <div className="proof-panel__headline"><span className="risk-badge risk-badge--high">Високий ризик</span><span className="mono">R-04</span></div>
            <h3>Вимога про аналогічний договір вужча за профіль компанії</h3>
            <p>Замовник вимагає підтвердження поставки саме поліетиленових труб протягом останніх 24 місяців. Загальний договір на сантехнічні матеріали може бути недостатнім.</p>
            <blockquote>«…не менше одного виконаного договору на поставку труб ПЕ 100…» <a href="#">Додаток 2, стор. 6 ↗</a></blockquote>
            <div className="proof-panel__action"><span>Наступний крок</span><b>Завантажити релевантний акт виконання або надіслати уточнення замовнику до 05 серпня.</b></div>
          </div>
        </div>
      </div>
    </section>
  );
}
