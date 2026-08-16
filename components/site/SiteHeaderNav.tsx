"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

const navItems = [
  { href: "/#product", label: "Як працює", index: "01" },
  { href: "/#pricing", label: "Тарифи", index: "02" },
  { href: "/guides", label: "База знань", index: "03" },
  { href: "/analyze", label: "Аналізатор", index: "04" },
];

export function SiteHeaderNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  // Портал монтуємо лише після першої взаємодії — уникаємо SSR-розбіжностей
  // і тримаємо оверлей поза header (у нього backdrop-filter ламає position: fixed).
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Закриваємо меню після навігації — коригування стану під час рендеру
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const toggle = () => {
    setMounted(true);
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
        onClick={toggle}
      >
        <i /><i />
      </button>
      {mounted && createPortal(
        <div className={open ? "mobile-nav is-open" : "mobile-nav"} aria-hidden={!open}>
          {navItems.map((item, index) => (
            <Link key={item.href} href={item.href} style={{ "--i": index + 1 } as React.CSSProperties} tabIndex={open ? 0 : -1}>
              {item.label}<small>{item.index}</small>
            </Link>
          ))}
          <div className="mobile-nav__foot">
            <Link className="button button--primary" href="/#analyze" tabIndex={open ? 0 : -1}>Аналізувати <ArrowUpRight size={16} /></Link>
            <Link className="button button--ghost" href={signedIn ? "/dashboard" : "/auth/sign-in"} prefetch={false} tabIndex={open ? 0 : -1} style={{ color: "#f5f2e8", borderColor: "rgba(255,255,255,.3)" }}>
              {signedIn ? "Кабінет" : "Увійти"}
            </Link>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
