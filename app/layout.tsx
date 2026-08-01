import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope, Unbounded } from "next/font/google";
import { MotionEffects } from "@/components/site/MotionEffects";
import "./globals.css";

const bodyFont = Manrope({ variable: "--font-body", subsets: ["latin", "cyrillic"], display: "swap" });
const displayFont = Unbounded({ variable: "--font-display", subsets: ["latin", "cyrillic"], display: "swap" });
const monoFont = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://vymoha.app"),
  title: { default: "Вимога — перевірка тендерів Prozorro", template: "%s — Вимога" },
  description: "Знайдіть стоп-фактори, документи й дедлайни тендера Prozorro до того, як команда витратить день на підготовку.",
  applicationName: "Вимога",
  keywords: ["Prozorro", "аналіз тендерної документації", "перевірка тендерної пропозиції", "тендери Україна"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "uk_UA", siteName: "Вимога",
    title: "Вимога — тендер вартий вашого часу?",
    description: "Автоматичний go/no-go аналіз закупівель Prozorro з доказами для кожного висновку.",
    images: [{ url: "/og-vymoha.jpg", width: 1200, height: 630, alt: "Вимога — рішення по тендеру з доказами" }],
  },
  twitter: { card: "summary_large_image", title: "Вимога", description: "Рішення по тендеру за хвилини, не години.", images: ["/og-vymoha.jpg"] },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-v2.png", shortcut: "/favicon-v2.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f0e7", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}><MotionEffects />{children}</body>
    </html>
  );
}
