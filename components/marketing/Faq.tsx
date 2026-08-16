import { Check } from "lucide-react";
import { faqItems } from "@/src/content/faq";

export function Faq() {
  return (
    <section className="faq faq-v3" data-reveal>
      <div className="container faq__grid">
        <div className="faq-v3__intro">
          <span className="section-index">04 / CLARITY</span>
          <h2>Питання перед<br />першим рішенням.</h2>
          <p>Не про технологію. Про те, що команда побачить, перевірить і зробить далі.</p>
          <ul className="faq-v3__promise">
            <li><Check size={14} /> Висновок із джерелом</li>
            <li><Check size={14} /> Невизначеність позначена</li>
            <li><Check size={14} /> Наступна дія визначена</li>
          </ul>
        </div>
        <div>
          {faqItems.map(({ question, answer }, index) => (
            <details key={question}>
              <summary><i>{String(index + 1).padStart(2, "0")}</i>{question}<span>+</span></summary>
              <div className="faq__answer"><div><p>{answer}</p></div></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}