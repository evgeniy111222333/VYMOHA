import type { Metadata, Viewport } from "next";
import { MotionEffects } from "@/components/site/MotionEffects";
import { ErrorReporter } from "@/components/seo/ErrorReporter";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/src/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: "Вимога — перевірка тендерів Prozorro", template: "%s — Вимога" },
  description: "Знайдіть стоп-фактори, документи й дедлайни тендера Prozorro до того, як команда витратить день на підготовку.",
  applicationName: "Вимога",
  keywords: ["Prozorro", "тендери", "закупівлі Україна", "аналіз тендерної документації", "перевірка тендерної пропозиції", "ризики участі в тендері", "тендерне забезпечення"],
  openGraph: {
    type: "website", locale: "uk_UA", siteName: "Вимога",
    title: "Вимога — тендер вартий вашого часу?",
    description: "Автоматичний go/no-go аналіз закупівель Prozorro з доказами для кожного висновку.",
    images: [{ url: "/og-vymoha-v2.webp", width: 1200, height: 630, alt: "Вимога — AI tender intelligence" }],
  },
  twitter: { card: "summary_large_image", title: "Вимога", description: "Рішення по тендеру за хвилини, не години.", images: ["/og-vymoha-v2.webp"] },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-v2.png", shortcut: "/favicon-v2.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0b0a", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Вимога",
          url: "https://vymoha.com",
          logo: "https://vymoha.com/brand-mark-v2.png",
          description: "Автоматичний go/no-go аналіз закупівель Prozorro з доказами для кожного висновку.",
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Вимога",
          url: "https://vymoha.com",
          inLanguage: "uk-UA",
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Вимога",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://vymoha.com",
          description: "Автоматичний go/no-go аналіз закупівель Prozorro з доказами для кожного висновку.",
          inLanguage: "uk-UA",
          offers: { "@type": "Offer", price: "149", priceCurrency: "UAH" },
        }} />
        <MotionEffects />
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
