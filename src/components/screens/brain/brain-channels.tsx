"use client";
// Screen 75 — Channels Configuration.
// Four sections of channels marked tracked / untracked. Tracked channels feed
// conversion analysis; untracked ones weaken precision.

import { useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SectionCard, InfoBanner } from "@/components/shared/layout";
import { ConfigShell } from "./parts";
import { channelSectionsFor, type ChannelSection } from "./parts";
import type { ScreenProps } from "../view-types";

export function BrainChannels({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);

  const sections: ChannelSection[] = channelSectionsFor(business.type);
  const defaults = Object.fromEntries(sections.flatMap((s) => s.channels).map((c) => [c.name, c.tracked]));

  const [store, setStore] = useState<{ owner: string; tracked: Record<string, boolean> } | null>(null);
  const tracked = store?.owner === businessId ? store.tracked : defaults;

  const allChannels = Object.entries(tracked);
  const trackedCount = allChannels.filter(([, v]) => v).length;
  const untrackedCount = allChannels.length - trackedCount;

  const toggle = (name: string, value: boolean) => {
    setStore({ owner: businessId, tracked: { ...tracked, [name]: value } });
    toast.success("Channel tracking updated", { description: `${name} is now ${value ? "tracked" : "untracked"}.` });
  };

  return (
    <ConfigShell
      title="Channels"
      description="Mark each channel as tracked or untracked. Tracked channels feed conversion analysis, CAC and channel-level recommendations."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50/70 p-4">
        <p className="text-sm">
          <span className="text-2xl font-semibold tnum">{trackedCount}</span>{" "}
          <span className="text-muted-foreground">of {allChannels.length} channels tracked</span>
        </p>
        <Badge variant="outline" className={untrackedCount === 0 ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700" : "border-amber-200 bg-amber-50 font-normal text-amber-700"}>
          {untrackedCount === 0 ? "Full precision" : `${untrackedCount} untracked`}
        </Badge>
      </div>

      <InfoBanner tone={untrackedCount === 0 ? "success" : "warning"}>
        {untrackedCount === 0
          ? "All channels are tracked — conversion analysis is at full precision."
          : "Untracked channels reduce conversion analysis precision. Customers whose path is not recorded appear as unattributed, which can overstate or understate a channel's real performance."}
      </InfoBanner>

      {sections.map((section) => {
        const sectionTracked = section.channels.filter((c) => tracked[c.name]).length;
        return (
          <SectionCard key={section.title} title={section.title} description={section.description} action={<span className="text-xs text-muted-foreground tnum">{sectionTracked} of {section.channels.length} tracked</span>}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {section.channels.map((c) => {
                const isTracked = tracked[c.name];
                return (
                  <li key={c.name} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <Badge variant="outline" className={`mt-1 font-normal ${isTracked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                        {isTracked ? "Tracked" : "Untracked"}
                      </Badge>
                    </div>
                    <Switch checked={isTracked} onCheckedChange={(v) => toggle(c.name, v)} aria-label={`Mark ${c.name} as ${isTracked ? "untracked" : "tracked"}`} />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Tracking is read-only in this prototype: channels marked tracked are the ones your connected sources and manual entries already record.
      </p>
    </ConfigShell>
  );
}
