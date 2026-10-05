"use client";
// Screen 92 — Export / Delete Business Data.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

export function ExportDelete() {
  const navigate = useBizz((s) => s.navigate);
  const businessName = useBizz((s) => s.settings.businessName);

  const [confirmText, setConfirmText] = useState("");
  const matches = useMemo(() => confirmText.trim() === businessName, [confirmText, businessName]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Export & Delete"
        description="Take a copy of your data, or remove this workspace entirely."
        back={
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("settings/privacy")}>
            Back to privacy settings
          </Button>
        }
      />

      <SectionCard title="Export your data" description="Delivered by email when the export is ready — usually within minutes.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Download report</p>
              <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted-foreground">
                A PDF of your latest weekly brief, monthly review and headline metrics — ready to share.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Export queued — you'll receive an email", {
                  description: "The report PDF will arrive at your account email shortly.",
                })
              }
            >
              <FileDown className="mr-1.5 size-4" aria-hidden /> Download report
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Download data archive</p>
              <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted-foreground">
                A CSV archive of everything you have entered or connected: monthly totals, manual entries, actions,
                goals and provenance records.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Archive queued — you'll receive an email", {
                  description: "The CSV archive will arrive with a secure download link.",
                })
              }
            >
              <FileDown className="mr-1.5 size-4" aria-hidden /> Download data archive
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-red-900">Danger zone — delete workspace</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-red-800/90">
              Deleting <span className="font-semibold">{businessName}</span> permanently removes the workspace, its
              connected sources, data history, goals, actions and reports. Team members lose access immediately. This
              cannot be undone.
            </p>

            <div className="mt-4 max-w-md space-y-2">
              <Label htmlFor="delete-confirm" className="text-xs font-medium text-red-900">
                Type &ldquo;{businessName}&rdquo; to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={businessName}
                aria-invalid={confirmText.length > 0 && !matches}
                className="border-red-200 bg-white focus-visible:ring-red-300"
              />
              {confirmText.length > 0 && !matches ? (
                <p className="text-xs text-red-600" role="alert">
                  The text does not match the workspace name exactly.
                </p>
              ) : null}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4" disabled={!matches}>
                  Delete this workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {businessName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Final confirmation. Everything in this workspace — sources, history, goals, actions and reports —
                    will be removed and cannot be recovered.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep workspace</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={() => toast.error("Deletion simulated in prototype — nothing was removed")}
                  >
                    Yes, delete workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
