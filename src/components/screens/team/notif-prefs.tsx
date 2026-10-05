"use client";
// Screen 83 — Notification Preferences (auto-saves on each change).

import { Mail, MonitorSmartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

const CATEGORIES: { key: string; description: string }[] = [
  { key: "Critical alerts", description: "Connection failures and urgent metric warnings that need attention." },
  { key: "Recommendations", description: "New diagnoses and suggested actions for your workspace." },
  { key: "Assignments", description: "Actions assigned to you, or updated by teammates." },
  { key: "Weekly brief", description: "Your Monday summary of the week's performance." },
  { key: "Monthly review", description: "The full monthly business review when it is ready." },
  { key: "Integration issues", description: "Sync delays, errors and authorization problems." },
];

export function NotificationPrefs() {
  const notifPrefs = useBizz((s) => s.settings.notifPrefs);
  const updateSettings = useBizz((s) => s.updateSettings);

  const setPref = (key: string, channel: "inApp" | "email", value: boolean) => {
    updateSettings({
      notifPrefs: { ...notifPrefs, [key]: { ...notifPrefs[key], [channel]: value } },
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Notification Preferences"
        description="Choose how each category reaches you. Changes save automatically."
      />

      <InfoBanner tone="info" title="Alerts vs notifications">
        Critical alerts always appear in the Alerts Centre inside the app, regardless of these settings. These
        preferences control how each category is delivered to you: in-app, by email, or both.
      </InfoBanner>

      <SectionCard title="Delivery by category" contentClassName="p-0">
        <ul className="divide-y">
          {CATEGORIES.map(({ key, description }) => {
            const pref = notifPrefs[key] ?? { inApp: true, email: false };
            return (
              <li key={key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 sm:max-w-md">
                  <p className="text-sm font-medium">{key}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={pref.inApp}
                      onCheckedChange={(v) => setPref(key, "inApp", v)}
                      aria-label={`${key} — in-app notifications`}
                    />
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MonitorSmartphone className="size-3.5" aria-hidden /> In-app
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={pref.email}
                      onCheckedChange={(v) => setPref(key, "email", v)}
                      aria-label={`${key} — email notifications`}
                    />
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="size-3.5" aria-hidden /> Email
                    </span>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Team members each set their own preferences. Workspace-level email defaults are configured by the Owner during
        beta.
      </p>
    </div>
  );
}
