import type { Metadata, Viewport } from "next";
import { MotionEffects } from "@/components/site/MotionEffects";
import { SITE_URL } from "@/src/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "Вимога — перевірка тендерів Prozorro", template: "%s — Вимога" },
  description: "Знайдіть стоп-фактори, документи й дедлайни тендера Prozorro до того, як команда витратить день на підготовку.",
  applicationName: "Вимога",
  keywords: ["Prozorro", "аналіз тендерної документації", "перевірка тендерної пропозиції", "тендери Україна"],
  openGraph: {
    type: "website", locale: "uk_UA", siteName: "Вимога",
    title: "Вимога — тендер вартий вашого часу?",
    description: "Автоматичний go/no-go аналіз закупівель Prozorro з доказами для кожного висновку.",
    images: [{ url: "/og-vymoha-v2.png", width: 1730, height: 909, alt: "Вимога — AI tender intelligence" }],
  },
  twitter: { card: "summary_large_image", title: "Вимога", description: "Рішення по тендеру за хвилини, не години.", images: ["/og-vymoha-v2.png"] },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-v2.png", shortcut: "/favicon-v2.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0b0a", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body><MotionEffects />{children}</body>
    </html>
  );
}
