"use client";
// Shared layout for legal pages (Privacy Policy, Terms of Service).
// Anchored sections with a sticky section nav on desktop.

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function LegalLayout({
  kicker,
  title,
  updated,
  intro,
  sections,
}: {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -66% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{kicker}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective {updated} · Nellovia (private beta)</p>
        <p className="mt-5 text-base leading-relaxed text-slate-600">{intro}</p>
      </div>
      <div className="mt-10 flex gap-10">
        <nav aria-label="Document sections" className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-0.5 border-l border-slate-200">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "-ml-px block w-full border-l-2 py-1.5 pl-4 text-left text-sm transition-colors",
                  active === s.id
                    ? "border-brand-600 font-medium text-brand-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
        </nav>
        <article className="min-w-0 flex-1 space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
              <h2 id={`${s.id}-title`} className="text-lg font-semibold tracking-tight text-slate-900">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 [&_li]:ml-4 [&_li]:list-disc [&_li]:space-y-1 [&_strong]:font-medium [&_strong]:text-slate-800">
                {s.body}
              </div>
            </section>
          ))}
          <p className="border-t pt-6 text-xs text-muted-foreground">
            Questions about this document? Reach us through the contact section above, or from anywhere in the product via Help &amp; support.
          </p>
        </article>
      </div>
    </div>
  );
}
