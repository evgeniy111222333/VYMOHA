import { BellRing, Building2, FileStack, Fingerprint, GitCompareArrows, ListChecks } from "lucide-react";

const features = [
  { icon: ListChecks, title: "Матриця відповідності", text: "Вимога → документ → статус → відповідальний. Один формат для всієї команди." },
  { icon: GitCompareArrows, title: "Контроль редакцій", text: "Бачите, що змінив замовник у документації та які перевірки треба пройти повторно." },
  { icon: Building2, title: "Профіль компанії", text: "CPV-коди, сертифікати й досвід враховуються в кожному go/no-go рішенні." },
  { icon: FileStack, title: "Сховище доказів", text: "Типові довідки й сертифікати зберігаються окремо від публічних тендерних даних." },
  { icon: BellRing, title: "Моніторинг змін", text: "Сповіщення про нову редакцію, питання, дедлайн і зміну статусу закупівлі." },
  { icon: Fingerprint, title: "Журнал дій", text: "Хто запускав аналіз, що змінив і на якій версії документації базується висновок." },
];

export function FeatureGrid() {
  return (
    <section className="feature-section" data-reveal>
      <div className="container">
        <div className="section-heading section-heading--compact"><div><span className="section-kicker">Робочий процес</span><h2>Не чат. Система перевірок.</h2></div></div>
        <div className="feature-grid">{features.map((feature) => <article key={feature.title} data-reveal><feature.icon size={22} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
      </div>
    </section>
  );
}
