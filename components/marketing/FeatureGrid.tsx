import type { CSSProperties } from "react";
import { BellRing, Building2, FileStack, Fingerprint, GitCompareArrows, ListChecks, Target, UsersRound } from "lucide-react";

const capabilities = [
  { icon: ListChecks, code: "REQ", title: "Матриця відповідності", text: "Вимога → доказ → статус → наступна дія." },
  { icon: Building2, code: "FIT", title: "Профіль компанії", text: "CPV, досвід і сертифікати впливають на рішення." },
  { icon: FileStack, code: "DOC", title: "Документи компанії", text: "Повторно використовуйте перевірені довідки та підтвердження." },
  { icon: GitCompareArrows, code: "DIF", title: "Контроль редакцій", text: "Повторна перевірка фокусується на змінених умовах." },
  { icon: BellRing, code: "MON", title: "Моніторинг", text: "Дедлайни, статуси та нові редакції тендера." },
  { icon: Target, code: "PLN", title: "План підготовки", text: "Кожен ризик перетворюється на конкретну дію." },
  { icon: Fingerprint, code: "LOG", title: "Журнал рішень", text: "Хто, коли й на основі якої версії ухвалив рішення." },
  { icon: UsersRound, code: "TEAM", title: "Командна робота", text: "Спільний висновок, ролі та контроль готовності." },
];

export function FeatureGrid() {
  return (
    <section className="feature-section feature-section-v3">
      <div className="container">
        <div className="editorial-heading editorial-heading--inverse" data-reveal>
          <span className="section-index">02 / OPERATIONS</span>
          <h2>Від першого URL<br /><em>до командного рішення.</em></h2>
          <p>Усе, що потрібно тендерному відділу, зібрано навколо одного доказового звіту.</p>
        </div>
        <div className="capability-matrix">
          {capabilities.map((item, index) => (
            <article key={item.code} data-reveal style={{ "--reveal-delay": `${index * 45}ms` } as CSSProperties}>
              <header><span>{item.code}</span><item.icon size={18} /></header>
              <h3>{item.title}</h3><p>{item.text}</p><i>{String(index + 1).padStart(2, "0")}</i>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
