"use client";
// Development only — open the fictional businesses used to test challenges
// (a bakery, a salon, an online store…) and come back to your own data.

import { useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/layout";
import { backToOwnData, listTestBusinesses, openTestBusiness, viewingTestBusiness, type TestBusiness } from "@/lib/test-businesses";
import type { ScreenProps } from "../view-types";

export default function TestBusinessesScreen(_props: ScreenProps) {
  const [items, setItems] = useState<TestBusiness[] | null>(null);
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listTestBusinesses()
      .then((list) => {
        if (!live) return;
        setItems(list);
        setViewing(viewingTestBusiness());
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  if (process.env.NODE_ENV === "production") {
    return <p className="py-16 text-center text-sm text-muted-foreground">Test businesses are only available while developing.</p>;
  }

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Test businesses"
        description="Fictional businesses used to test challenges across different kinds of business. Opening one puts your own data aside in this browser — “Back to my own data” brings it back exactly. Click around freely: changes inside a test business aren't kept, and nothing from it is saved to your account."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <FlaskConical className="size-3" aria-hidden /> Development only
          </span>
        }
      />

      {viewing ? (
        <Card className="mb-5 flex flex-col gap-3 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950">
            You&apos;re looking at <span className="font-semibold">{viewing.name}</span>. Your own data is put aside, safe.
          </p>
          <Button onClick={() => run("__back", backToOwnData)} disabled={busy !== null} className="bg-amber-600 text-white hover:bg-amber-700">
            {busy === "__back" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowLeft className="size-4" aria-hidden />}
            Back to my own data
          </Button>
        </Card>
      ) : (
        <p className="mb-5 flex items-center gap-2 text-sm text-emerald-800">
          <ShieldCheck className="size-4" aria-hidden /> You&apos;re on your own data now.
        </p>
      )}

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No test businesses are saved in this browser.</p>
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <Card key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{b.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{b.story}</p>
                <p className="mt-1 text-xs text-slate-400">Saved {new Date(b.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <Button
                variant={viewing?.id === b.id ? "outline" : "default"}
                className={viewing?.id === b.id ? "" : "bg-brand-600 hover:bg-brand-700"}
                disabled={busy !== null || viewing?.id === b.id}
                onClick={() => run(b.id, () => openTestBusiness(b.id))}
              >
                {busy === b.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {viewing?.id === b.id ? "Open now" : "Open it"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** A thin bar on every page while a test business is open, with the way back. */
export function TestBusinessBanner() {
  // The shell only renders in the browser, so the flag can be read on the first render.
  const [viewing] = useState<{ id: string; name: string } | null>(() =>
    process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? viewingTestBusiness() : null,
  );
  const [busy, setBusy] = useState(false);
  if (!viewing) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 sm:px-6">
      <span className="flex items-center gap-2">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        Test business: <span className="font-semibold">{viewing.name}</span> — your own data is put aside, safe. Changes here aren&apos;t kept.
      </span>
      <span className="flex gap-2">
        <Button size="sm" variant="ghost" className="h-8 text-amber-950 hover:bg-amber-200" onClick={() => (window.location.hash = "#/test-businesses")}>
          All test businesses
        </Button>
        <Button
          size="sm"
          className="h-8 bg-amber-600 text-white hover:bg-amber-700"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void backToOwnData().catch(() => setBusy(false));
          }}
        >
          Back to my own data
        </Button>
      </span>
    </div>
  );
}
