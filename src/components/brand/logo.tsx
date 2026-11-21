// Nellovia's brand mark and wordmark. The same drawing is in src/app/icon.svg (favicon) and
// docs/brand/ (alternates and sizes); change them together.
//
// The mark is an "N" drawn as one line: it climbs, dips (what's holding the business back),
// then rises past where it started into an arrow — the next step to grow.

import { cn } from "@/lib/utils";

/** Twitter blue. The mark is always this exact colour; UI text uses the darker brand shades. */
export const BRAND_BLUE = "#1DA1F2";

/** Path of the white "N" line with its arrow, on a 32×32 grid. */
export const MARK_PATH = "M8 23.5V11L20.5 23.5V8.6M16.4 12.7L20.5 8.6L24.6 12.7";

export function NelloviaMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill={BRAND_BLUE} />
      <path d={MARK_PATH} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "Nellovia" wordmark. Put it inside the link or button that leads home. */
export function NelloviaLogo({
  dark = false,
  suffix,
  className,
}: {
  /** White wordmark, for dark surfaces (the admin sidebar). */
  dark?: boolean;
  /** A product area after the wordmark, e.g. "Specialists". */
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <NelloviaMark />
      <span className={cn("text-[15px] font-bold tracking-tight", dark ? "text-white" : "text-slate-900")}>
        Nellovia
        {suffix ? <span className={cn("ml-1 font-medium", dark ? "text-slate-300" : "text-slate-500")}>{suffix}</span> : null}
      </span>
    </span>
  );
}
