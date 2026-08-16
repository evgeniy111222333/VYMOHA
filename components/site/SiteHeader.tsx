import { ArrowUpRight, LayoutDashboard, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getAuthUser } from "@/app/auth";
import { Logo } from "@/components/brand/Logo";
import { SiteHeaderNav } from "@/components/site/SiteHeaderNav";

export async function SiteHeader() {
  const user = await getAuthUser();

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
          {user ? (
            <Link href="/dashboard" className="header-user-badge" prefetch={false} title={`Акаунт: ${user.email}`}>
              <span className="header-user-badge__icon">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={24} height={24} unoptimized />
                ) : (
                  <User size={13} />
                )}
              </span>
              <span>Кабінет</span>
              <LayoutDashboard size={13} className="header-user-badge__dash" />
            </Link>
          ) : (
            <Link href="/auth/sign-in" className="text-link" prefetch={false}>
              Увійти
            </Link>
          )}
          <Link href="/#analyze" className="button button--small button--dark" data-magnetic>
            Аналізувати <ArrowUpRight size={15} />
          </Link>
          <SiteHeaderNav signedIn={Boolean(user)} />
        </div>
      </div>
      <span className="site-header__progress" aria-hidden="true" />
    </header>
  );
}
