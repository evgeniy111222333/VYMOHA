"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * V4 motion layer. Усе нижче — прогресивне покращення:
 * без JS сторінка повністю читабельна, з JS — оживає.
 * Шанує prefers-reduced-motion і не чіпає touch-ввід.
 */
export function MotionEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const root = document.documentElement;
    root.classList.add("motion-ready");
    if (reduced) root.classList.add("reduce-motion");

    const cleanups: Array<() => void> = [];
    const animated = !reduced;

    /* ---- 1. header: стан скролу + прогрес-лінія ---- */
    const header = document.querySelector<HTMLElement>(".site-header");
    const progress = header?.querySelector<HTMLElement>(".site-header__progress") ?? null;
    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        header?.classList.toggle("is-scrolled", y > 24);
        if (progress) {
          const max = root.scrollHeight - window.innerHeight;
          progress.style.setProperty("--scroll-p", max > 0 ? String(Math.min(1, y / max)) : "0");
        }
        scrollTicking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    /* ---- 2. reveal: blur + rise + scale ---- */
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 }
    );
    revealTargets.forEach((target, index) => {
      const rect = target.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        target.classList.add("is-visible");
      } else {
        if (!target.style.getPropertyValue("--reveal-delay")) {
          target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
        }
        revealObserver.observe(target);
      }
    });
    cleanups.push(() => revealObserver.disconnect());

    if (animated) {
      /* ---- 3. count-up для [data-count] ---- */
      const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
      const runCounter = (el: HTMLElement) => {
        const target = Number.parseFloat(el.dataset.count ?? "0");
        if (!Number.isFinite(target)) return;
        const suffix = el.dataset.countSuffix ?? "";
        const duration = 1150;
        const startedAt = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${Math.round(target * eased)}${suffix}`;
          if (p < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
      };
      const counterObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            runCounter(entry.target as HTMLElement);
            counterObserver.unobserve(entry.target);
          }
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => counterObserver.observe(el));
      cleanups.push(() => counterObserver.disconnect());

      /* ---- 4. spotlight: світло за курсором ---- */
      if (finePointer) {
        let spotTarget: HTMLElement | null = null;
        const onSpotMove = (event: PointerEvent) => {
          const next = (event.target as HTMLElement | null)?.closest?.("[data-spot]") as HTMLElement | null;
          if (next !== spotTarget) spotTarget = next;
          if (!spotTarget) return;
          const rect = spotTarget.getBoundingClientRect();
          spotTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
          spotTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
        };
        window.addEventListener("pointermove", onSpotMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onSpotMove));
      }

      /* ---- 5. magnetic кнопки ---- */
      if (finePointer) {
        const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
        const magnetCleanups = magnets.map((el) => {
          const strength = 12;
          const onMove = (event: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            const relX = (event.clientX - rect.left) / rect.width - 0.5;
            const relY = (event.clientY - rect.top) / rect.height - 0.5;
            el.style.transform = `translate(${relX * strength}px, ${relY * strength}px)`;
          };
          const onLeave = () => { el.style.transform = ""; };
          el.addEventListener("pointermove", onMove, { passive: true });
          el.addEventListener("pointerleave", onLeave);
          return () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
          };
        });
        cleanups.push(() => magnetCleanups.forEach((fn) => fn()));
      }

      /* ---- 6. tilt для [data-tilt] у межах hero ---- */
      if (finePointer) {
        const hero = document.querySelector<HTMLElement>(".hero");
        const tiltTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
        const onTilt = (event: PointerEvent) => {
          if (!hero || event.pointerType === "touch") return;
          const rect = hero.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / rect.width - 0.5;
          const relY = (event.clientY - rect.top) / rect.height - 0.5;
          for (const el of tiltTargets) {
            el.style.setProperty("--tilt-x", `${relY * -3.2}deg`);
            el.style.setProperty("--tilt-y", `${relX * 4.2}deg`);
          }
        };
        const onTiltLeave = () => {
          for (const el of tiltTargets) {
            el.style.removeProperty("--tilt-x");
            el.style.removeProperty("--tilt-y");
          }
        };
        hero?.addEventListener("pointermove", onTilt, { passive: true });
        hero?.addEventListener("pointerleave", onTiltLeave);
        cleanups.push(() => {
          hero?.removeEventListener("pointermove", onTilt);
          hero?.removeEventListener("pointerleave", onTiltLeave);
        });
      }
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [pathname]);

  return null;
}
