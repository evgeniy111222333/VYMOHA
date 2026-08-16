"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/errors", new Blob([JSON.stringify({
          name: error.name, message: error.message, route: window.location.pathname, stack: error.stack,
        })], { type: "application/json" }));
      }
    } catch { /* ignore */ }
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080a08", color: "#f5f2e8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Щось пішло не так</h1>
        <p style={{ color: "#9ba396", margin: "0 0 20px", lineHeight: 1.6 }}>Сталася помилка. Спробуйте оновити сторінку або повернутися на головну.</p>
        <button onClick={reset} style={{ background: "#a8ff2a", color: "#090b09", border: 0, padding: "12px 22px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Спробувати ще раз</button>
      </div>
    </div>
  );
}
