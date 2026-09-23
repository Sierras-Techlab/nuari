"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

const delayClasses: Record<number, string> = {
  0: "delay-0",
  40: "delay-75",
  75: "delay-75",
  80: "delay-100",
  150: "delay-150",
  200: "delay-200",
};

export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.classList.add("reveal-enhanced");
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      element.classList.add("reveal-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("reveal-visible");
        observer.disconnect();
      },
      { threshold: 0.01, rootMargin: "0px 0px 15%" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`reveal ${delayClasses[delay] ?? "delay-0"} ${className}`}>{children}</div>;
}
