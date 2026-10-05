"use client";
// Screen 87 — Privacy & Data Permissions.

import { useState } from "react";
import { toast } from "sonner";
import { Brain, Database, FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { INTEGRATIONS } from "@/lib/data/operations";

export function PrivacySettings() {
  const navigate = useBizz((s) => s.navigate);
  const connections = useBizz((s) => s.connections);

  const [improve, setImprove] = useState(true);
  const [productEmails, setProductEmails] = useState(false);

  const connected = INTEGRATIONS.filter((i) => connections[i.id] === "connected");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Privacy & Data Permissions"
        description="What bizzGrowth reads from your connected sources, how long data is kept, and how AI uses it."
      />

      <SectionCard
        title="Connected-data permissions"
        description="Each source is read-only. We never modify your accounts."
        contentClassName="p-0"
      >
        <ul className="divide-y">
          {connected.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0 sm:max-w-md">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                  {i.name}
                  <span className="text-xs font-normal text-muted-foreground">({i.badge} access)</span>
                </p>
                <p className="mt-0.5 pl-5.5 text-xs leading-relaxed text-muted-foreground">
                  What we read: {i.permissions.read.join(", ")}.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`source-settings/${i.id}`)}>
                Manage
              </Button>
            </li>
          ))}
          {connected.length === 0 ? (
            <li className="px-5 py-6 text-sm text-muted-foreground">
              No sources are connected yet. Anything you enter manually is used only inside this workspace.
            </li>
          ) : null}
        </ul>
      </SectionCard>

      <SectionCard
        title="Data retention"
        action={<Database className="size-4 text-slate-400" aria-hidden />}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your business data is kept for as long as your workspace is active. Connected sources sync on a rolling
          schedule; disconnecting a source stops new data collection immediately, while previously analysed history is
          retained for 12 months. You can delete a source&apos;s history earlier from its source settings, and you can
          export or delete everything at any time.
        </p>
      </SectionCard>

      <SectionCard title="How AI uses your data" action={<Brain className="size-4 text-violet-500" aria-hidden />}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your data is used to generate diagnoses for your workspace only — it is never used to train models that serve
          other businesses. Where a conclusion is an interpretation rather than a measurement, it is always labelled
          &ldquo;AI interpretation&rdquo; and carries an explicit confidence level, so measured data and AI reasoning
          are never presented the same way.
        </p>
      </SectionCard>

      <SectionCard title="Consent controls" contentClassName="p-0">
        <ul className="divide-y">
          <li className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium">Use my data to improve diagnoses</p>
              <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                Anonymised patterns help improve recommendation quality. Leave this off and your data stays
                workspace-only.
              </p>
            </div>
            <Switch
              checked={improve}
              onCheckedChange={(v) => {
                setImprove(v);
                toast.success(v ? "Thanks — anonymised improvement enabled" : "Improvement programme disabled", {
                  description: "Diagnosis quality is unaffected either way.",
                });
              }}
              aria-label="Use my data to improve diagnoses"
            />
          </li>
          <li className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium">Product emails</p>
              <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                Occasional product updates. Critical service emails are always sent regardless of this setting.
              </p>
            </div>
            <Switch
              checked={productEmails}
              onCheckedChange={(v) => {
                setProductEmails(v);
                toast.success("Preference updated");
              }}
              aria-label="Product emails"
            />
          </li>
        </ul>
      </SectionCard>

      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Take a copy of everything, or delete this workspace entirely.</p>
        <Button variant="outline" onClick={() => navigate("settings/export-delete")}>
          <FileDown className="mr-1.5 size-4" aria-hidden /> Export my data
        </Button>
      </div>
    </div>
  );
}
