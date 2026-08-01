import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo />
        <nav className="site-nav" aria-label="Основна навігація">
          <Link href="/#product">Як працює</Link>
          <Link href="/#pricing">Тарифи</Link>
          <Link href="/guides">База знань</Link>
        </nav>
        <div className="site-header__actions">
          <Link href="/dashboard" className="text-link" prefetch={false}>Увійти</Link>
          <Link href="/#analyze" className="button button--small button--dark">Аналізувати <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}
