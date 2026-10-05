"use client";
// Screen 84 — Workspace / Business Settings.

import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

const CURRENCIES = ["₦ (Nigerian Naira)", "$ (US Dollar)", "£ (British Pound)", "€ (Euro)"];
const TIMEZONES = ["Africa/Lagos (WAT)", "Africa/Abidjan (GMT)", "Europe/London (GMT/BST)", "UTC"];
const PERIODS = ["Calendar month", "4-week cycle", "Calendar quarter"];
const COMPARISONS = ["Previous period", "Previous month"];

export function BusinessSettings() {
  const settings = useBizz((s) => s.settings);
  const updateSettings = useBizz((s) => s.updateSettings);

  const [name, setName] = useState(settings.businessName);
  const [currency, setCurrency] = useState(settings.currency);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [period, setPeriod] = useState(settings.reportingPeriod);
  const [comparison, setComparison] = useState(settings.comparisonPeriod);

  const save = () => {
    updateSettings({ businessName: name.trim(), currency, timezone, reportingPeriod: period, comparisonPeriod: comparison });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Workspace Settings"
        description="Details used across your reports, briefs, exports and diagnoses."
      />

      <SectionCard title="Business profile">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="biz-name">Business name</Label>
            <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <p className="text-xs text-muted-foreground">Appears in the sidebar, on reports and in invitations.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-slate-400">
                <ImagePlus className="size-5" aria-hidden />
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => toast.success("Logo upload simulated", { description: "In the full product you could upload a PNG or SVG up to 2 MB." })}>
                  Upload logo
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG or SVG, square. Shown on exported reports.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="biz-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="biz-currency" aria-label="Currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-tz">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="biz-tz" aria-label="Timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Reporting" description="How periods are cut and compared across the workspace.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="biz-period">Reporting period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="biz-period" aria-label="Reporting period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-compare">Default comparison</Label>
            <Select value={comparison} onValueChange={setComparison}>
              <SelectTrigger id="biz-compare" aria-label="Default comparison">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARISONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applied to performance pages and briefs. Custom ranges come after beta.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => { setName(settings.businessName); setCurrency(settings.currency); setTimezone(settings.timezone); setPeriod(settings.reportingPeriod); setComparison(settings.comparisonPeriod); }}>
          Reset
        </Button>
        <Button onClick={save} disabled={!name.trim()}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
