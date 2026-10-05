"use client";
// Screen 73 — Customer / Target Market Configuration.
// A lightweight profile — not a CRM. Segments, mix, locations, typical
// customer and high-value segments, all editable via dialogs.

import { useState } from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/shared/layout";
import { ConfidenceBadge, ProvenanceBadge } from "@/components/shared/badges";
import { DonutChart } from "@/components/shared/charts";
import { ConfigShell, savedToast } from "./parts";
import { Pencil, Star, UsersRound } from "lucide-react";
import { fmtNaira } from "@/lib/format";
import type { ScreenProps } from "../view-types";

interface Segment {
  name: string;
  share: string;
  note: string;
}

function segmentsFor(type: "service" | "ecommerce"): Segment[] {
  if (type === "ecommerce") {
    return [{ name: "Home-decor shoppers", share: "Core segment", note: "Aged 25–45, urban, mobile-first. Furnishing and upgrading living spaces." }];
  }
  return [
    { name: "B2B SMEs", share: "60% of revenue", note: "Small and medium businesses shipping documents and parcels on a schedule." },
    { name: "B2C individuals", share: "40% of revenue", note: "Personal deliveries and one-off moves, often discovered via Instagram." },
  ];
}

function typicalCustomerFor(type: "service" | "ecommerce"): string {
  if (type === "ecommerce") {
    return "A 25–45 year-old urban professional who discovers KoraHome on Instagram, browses on mobile in the evening, and pays on delivery or by card. Buys 1–2 decor pieces per order and returns for matching items within a few months.";
  }
  return "An operations or admin lead at a 5–50 person business in Lagos, shipping weekly and comparing mainly on reliability and pickup speed. Individual customers book one-off deliveries after seeing Instagram or Google listings.";
}

export function BrainCustomers({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);
  const isService = business.type === "service";

  const [store, setStore] = useState<{ owner: string; segments: Segment[]; locations: string[]; typical: string } | null>(null);
  const isCurrent = store?.owner === businessId;
  const segments = isCurrent ? store.segments : segmentsFor(business.type);
  const locations = isCurrent ? store.locations : ["Lagos", "Abuja", "Port Harcourt"];
  const typical = isCurrent ? store.typical : typicalCustomerFor(business.type);
  const update = (patch: { segments?: Segment[]; locations?: string[]; typical?: string }) =>
    setStore({ owner: businessId, segments, locations, typical, ...patch });

  const [segDialog, setSegDialog] = useState<number | null>(null);
  const [segDraft, setSegDraft] = useState<Segment>({ name: "", share: "", note: "" });
  const [locDialog, setLocDialog] = useState(false);
  const [locDraft, setLocDraft] = useState("");
  const [typicalDialog, setTypicalDialog] = useState(false);
  const [typicalDraft, setTypicalDraft] = useState("");

  const openSegment = (i: number) => {
    setSegDraft(segments[i]);
    setSegDialog(i);
  };

  const saveSegment = () => {
    if (segDialog === null) return;
    update({ segments: segments.map((seg, i) => (i === segDialog ? { ...segDraft, name: segDraft.name.trim() || seg.name } : seg)) });
    savedToast("Customer profile updated", "Segments feed segment-aware recommendations.");
    setSegDialog(null);
  };

  const saveLocations = () => {
    const list = locDraft
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    if (list.length === 0) {
      savedToast("Customer profile updated", "Keep at least one location so local recommendations stay relevant.");
      setLocDialog(false);
      return;
    }
    update({ locations: list });
    savedToast("Customer profile updated", "Locations now drive local channel guidance.");
    setLocDialog(false);
  };

  const saveTypical = () => {
    update({ typical: typicalDraft.trim() || typical });
    savedToast("Customer profile updated", "The typical customer shapes tone and channel advice.");
    setTypicalDialog(false);
  };

  const highValue =
    business.type === "ecommerce"
      ? [
          {
            name: "Kora Rattan Lounge Chair buyers",
            detail: `Average order ${fmtNaira(Math.round(2150000 / 196))} — above the store average of ${fmtNaira(8378)}.`,
          },
          { name: "Repeat buyers", detail: "18.4% repeat rate at 1.35 orders per customer — the most profitable demand." },
        ]
      : [
          { name: "Corporate Logistics accounts", detail: `Average ${fmtNaira(233000)} per month per account (₦2.57m across 11 accounts).` },
          { name: "Repeat corporate clients", detail: "Steadiest weekly volume and the strongest repeat usage recorded." },
        ];

  const mixData = isService
    ? [
        { name: "B2B SMEs", value: 60 },
        { name: "B2C individuals", value: 40 },
      ]
    : [{ name: "B2C individuals", value: 100 }];

  return (
    <ConfigShell
      title="Customer / target market"
      description="Who buys from you and where. The AI uses this to tune segments, channel advice and tone — it stays deliberately lightweight."
    >
      <SectionCard
        title="Primary customer segments"
        description="The segments that make up most of your revenue."
        action={
          <ConfidenceBadge level="medium" />
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {segments.map((seg, i) => (
            <div key={seg.name} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold">{seg.name}</h3>
                  <Badge variant="outline" className="mt-1 border-blue-200 bg-blue-50 font-normal text-blue-700 tnum">
                    {seg.share}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => openSegment(i)} aria-label={`Edit ${seg.name} segment`}>
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{seg.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <ProvenanceBadge provenance="user-supplied" source="Conversational checkup" />
          <span className="text-xs text-muted-foreground">Shares are your estimate — refine them as data accumulates.</span>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="B2B / B2C mix" description={isService ? "Share of revenue by customer type." : "This store sells to individuals."}>
          {isService ? (
            <DonutChart data={mixData} height={200} />
          ) : (
            <div className="flex flex-wrap items-center gap-2 py-8">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 px-3 py-1 text-sm font-normal text-blue-700">
                B2C — 100% of revenue
              </Badge>
              <span className="text-xs text-muted-foreground">No recorded business buyers yet.</span>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Locations"
          description="Where your customers are concentrated."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocDraft(locations.join(", "));
                setLocDialog(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden /> Edit
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => (
              <Badge key={l} variant="outline" className="bg-slate-50 px-3 py-1 font-normal">
                <UsersRound className="mr-1 size-3.5" aria-hidden /> {l}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {isService ? "Primary operating cities for pickup and delivery." : "Top delivery destinations; the store delivers nationwide."}
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Typical customer"
        description="A short narrative the AI uses to keep advice grounded."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTypicalDraft(typical);
              setTypicalDialog(true);
            }}
          >
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Button>
        }
      >
        <p className="text-[15px] leading-7 text-slate-700">{typical}</p>
      </SectionCard>

      <SectionCard title="High-value segments" description="Segments worth protecting and growing first.">
        <ul className="space-y-3">
          {highValue.map((h) => (
            <li key={h.name} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <Star className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{h.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground tnum">{h.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Values are derived from recorded revenue and order data for the current reporting month.</p>
      </SectionCard>

      <p className="text-xs text-muted-foreground">This is a lightweight profile, not a CRM — it holds just enough context to steer recommendations.</p>

      <Dialog open={segDialog !== null} onOpenChange={(open) => !open && setSegDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit segment</DialogTitle>
            <DialogDescription>Adjust the segment name, its share and a one-line note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="seg-name">Name</Label>
              <Input id="seg-name" value={segDraft.name} onChange={(e) => setSegDraft({ ...segDraft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seg-share">Share</Label>
              <Input id="seg-share" value={segDraft.share} onChange={(e) => setSegDraft({ ...segDraft, share: e.target.value })} placeholder="e.g. 60% of revenue" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seg-note">Note</Label>
              <Textarea id="seg-note" rows={3} value={segDraft.note} onChange={(e) => setSegDraft({ ...segDraft, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveSegment}>Save segment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locDialog} onOpenChange={setLocDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit locations</DialogTitle>
            <DialogDescription>Separate multiple locations with commas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="loc-input">Locations</Label>
            <Input id="loc-input" value={locDraft} onChange={(e) => setLocDraft(e.target.value)} placeholder="Lagos, Abuja, Port Harcourt" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveLocations}>Save locations</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typicalDialog} onOpenChange={setTypicalDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit typical customer</DialogTitle>
            <DialogDescription>Describe the customer you serve most often.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="typical-input">Description</Label>
            <Textarea id="typical-input" rows={5} value={typicalDraft} onChange={(e) => setTypicalDraft(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypicalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveTypical}>Save description</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfigShell>
  );
}
