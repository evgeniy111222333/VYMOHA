import { ArrowUpRight, Bot, Braces, CheckCircle2, FileText, MessageSquareText, ScanLine, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function ProductProof() {
  return <section className="product-proof product-proof-v3" id="product">
    <div className="container">
      <div className="editorial-heading" data-reveal><span className="section-index">01 / INTELLIGENCE</span><h2>Не ще один чат.<br /><em>Система прийняття рішень.</em></h2><p>Система читає документацію й додатки, розпізнає таблиці та зіставляє кожен висновок із конкретним джерелом.</p></div>
      <div className="intelligence-bento">
        <article className="bento-card bento-card--workspace" data-reveal>
          <header><span><ScanLine size={17} /> Document intelligence</span><code>2 / 2 files processed</code></header>
          <div className="document-stage"><aside><span className="is-active">ТД.pdf</span><span>Додаток 2.pdf</span><i /></aside><div><div className="document-highlight"><small>ДОДАТОК 2 · СТОРІНКА 6</small><p>Учасник підтверджує виконання не менше одного аналогічного договору на постачання кабелю…</p><span>Виявлено вимогу</span></div><div className="extraction-row"><span><FileText size={15} /> Досвід</span><b>Аналогічний договір</b><em>перевірити</em></div><div className="extraction-row"><span><ShieldAlert size={15} /> Ризик</span><b>Вузьке визначення предмета</b><em>high</em></div></div></div>
        </article>
        <article className="bento-card bento-card--decision" data-reveal><span className="bento-icon"><Bot size={22} /></span><small>DECISION ENGINE</small><h3>Go / maybe / no-go — лише після доказів.</h3><p>Без профілю компанії система не видає оптимістичне «можна заходити».</p><div className="decision-spectrum"><i /><span>NO-GO</span><span>MAYBE</span><span>GO</span></div></article>
        <article className="bento-card bento-card--schema" data-reveal><span className="bento-icon"><Braces size={22} /></span><small>STRUCTURED OUTPUT</small><h3>Результат завжди у стабільній схемі.</h3><div className="schema-code"><span>requirements <b>32</b></span><span>risks <b>12</b></span><span>questions <b>6</b></span><span>sources <b>100%</b></span></div></article>
        <article className="bento-card bento-card--questions" data-reveal><header><MessageSquareText size={18} /><span>Питання замовнику</span></header><ol><li>Чи приймається договір на суміжний CPV?</li><li>Який формат підтвердження походження?</li><li>Чи потрібна гарантія на кожен лот?</li></ol><Link href="/analyze">Сформувати для тендера <ArrowUpRight size={15} /></Link></article>
        <article className="bento-card bento-card--refund" data-reveal><CheckCircle2 size={22} /><div><small>DECISION READY</small><h3>Підтверджені факти, відкриті питання та припущення — окремо.</h3></div></article>
      </div>
    </div>
  </section>;
}
