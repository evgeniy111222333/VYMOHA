"use client";

import { useEffect } from "react";

function send(payload: Record<string, unknown>): void {
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/errors", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (sent) return;
    }
  } catch { /* fall through */ }
  fetch("/api/errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      send({
        name: event.error?.name ?? "WindowError",
        message: event.message ?? "Unknown client error",
        route: window.location.pathname,
        stack: event.error?.stack,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string; stack?: string } | undefined;
      send({
        name: reason?.name ?? "UnhandledRejection",
        message: reason?.message ?? String(event.reason),
        route: window.location.pathname,
        stack: reason?.stack,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
