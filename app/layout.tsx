import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

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
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f0e7", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
