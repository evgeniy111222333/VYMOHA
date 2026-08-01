import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Вимога — аналіз закупівель Prozorro",
    short_name: "Вимога",
    description: "Go/no-go аналіз тендерів із доказами для кожного висновку.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e7",
    theme_color: "#111412",
    lang: "uk",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
