import { Logo } from "@/components/brand/Logo";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Logo />
          <p>Тендерна розвідка з доказами, контрольованими витратами та чесною невизначеністю.</p>
        </div>
        <div><strong>Продукт</strong><Link href="/analyze">Аналізатор</Link><Link href="/dashboard" prefetch={false}>Кабінет</Link><Link href="/dashboard/billing" prefetch={false}>AI-кредити</Link></div>
        <div><strong>Матеріали</strong><Link href="/guides">База знань</Link><Link href="/guides/dokumenty-dlia-uchasti">Документи для участі</Link><Link href="/guides/prychyny-vidkhylennia">Причини відхилення</Link></div>
        <div><strong>Правова інформація</strong><Link href="/privacy">Конфіденційність</Link><Link href="/terms">Умови використання</Link><a href="mailto:hello@vymoha.app">hello@vymoha.app</a></div>
      </div>
      <div className="container site-footer__bottom"><span>© 2026 Вимога</span><span>Дані про закупівлі: Prozorro</span></div>
    </footer>
  );
}
