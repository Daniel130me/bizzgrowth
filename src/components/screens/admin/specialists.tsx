"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import type { SpecialistDTO } from "@/lib/market";

type Application = SpecialistDTO & { status: string; submittedAt: string | null; reviewNote: string | null };

export function SpecialistApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/market/admin/specialists?status=submitted", { cache: "no-store" });
      const json = (await response.json()) as { ok?: boolean; specialists?: Application[]; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Applications could not be loaded.");
      setApplications(json.specialists || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Applications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(application: Application, decision: "approve" | "reject") {
    const note = (notes[application.id] || "").trim();
    if (decision === "reject" && note.length < 10) {
      toast.error("Add clear feedback", { description: "Rejection feedback must be at least 10 characters." });
      return;
    }
    setWorking(`${application.id}:${decision}`);
    try {
      const response = await fetch(`/api/market/admin/specialists/${application.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "The review could not be saved.");
      setApplications((current) => current.filter((item) => item.id !== application.id));
      toast.success(decision === "approve" ? "Profile approved" : "Changes requested");
    } catch (caught) {
      toast.error("Review not saved", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Specialist applications" description="Review submitted profiles before they appear in search or receive invitations." />
      {loading ? <LoadingState label="Loading applications" rows={4} /> : error ? <ErrorState title="Applications unavailable" description={error} onRetry={() => void load()} /> : applications.length === 0 ? <EmptyState icon={<BadgeCheck className="size-5" />} title="Review queue is clear" description="New specialist submissions will appear here." /> : (
        <div className="space-y-4">
          {applications.map((application) => (
            <SectionCard key={application.id} title={application.name} description={`${application.headline} · ${application.category}`} action={<Badge variant="outline">Submitted</Badge>}>
              <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                <div className="space-y-3 text-sm">
                  <p className="leading-relaxed">{application.bio}</p>
                  <div className="flex flex-wrap gap-1.5">{application.skills.map((skill) => <Badge key={skill} variant="outline" className="font-normal">{skill}</Badge>)}</div>
                  <p className="text-muted-foreground">{application.location} · {application.languages.join(", ")} · ₦{application.hourlyRate.toLocaleString("en-NG")}/hour</p>
                  {application.portfolio.map((item) => <div key={item.title} className="rounded-lg border p-3"><p className="font-medium">{item.title}</p><p className="mt-1 text-muted-foreground">{item.blurb}</p></div>)}
                </div>
                <div className="space-y-3">
                  <Textarea value={notes[application.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} maxLength={1000} rows={5} placeholder="Approval note or specific changes required…" />
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={Boolean(working)} onClick={() => void decide(application, "approve")}>{working === `${application.id}:approve` ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}Approve</Button>
                    <Button className="flex-1" variant="outline" disabled={Boolean(working)} onClick={() => void decide(application, "reject")}>{working === `${application.id}:reject` ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}Request changes</Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
