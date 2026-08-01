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
    icons: [{ src: "/favicon-v2.png", sizes: "64x64", type: "image/png" }, { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  };
}
