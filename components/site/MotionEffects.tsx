"use client";

import { useEffect } from "react";

export function MotionEffects() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("motion-ready");
    if (reduced) { root.classList.add("reduce-motion"); return; }
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 });
    targets.forEach((target, index) => {
      target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
      observer.observe(target);
    });
    const hero = document.querySelector<HTMLElement>(".hero");
    const report = document.querySelector<HTMLElement>(".hero-report");
    const move = (event: PointerEvent) => {
      if (!hero || !report || event.pointerType === "touch") return;
      const rect = hero.getBoundingClientRect();
      report.style.setProperty("--tilt-x", `${((event.clientY - rect.top) / rect.height - .5) * -3}deg`);
      report.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - .5) * 4}deg`);
    };
    hero?.addEventListener("pointermove", move, { passive: true });
    return () => { observer.disconnect(); hero?.removeEventListener("pointermove", move); };
  }, []);
  return null;
}
