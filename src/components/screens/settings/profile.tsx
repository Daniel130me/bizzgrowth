"use client";
// Screen 85 — User Profile.

import { useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileSettings() {
  const user = useBizz((s) => s.user);
  const updateProfile = useBizz((s) => s.updateProfile);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [jobRole, setJobRole] = useState(user.jobRole);
  const [touched, setTouched] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const canSave = name.trim().length > 1 && emailOk;

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    updateProfile({ name: name.trim(), email: email.trim(), jobRole: jobRole.trim() });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Your Profile"
        description="How you appear to teammates on actions, data entries and approvals."
      />

      <SectionCard title="Profile details">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700" aria-hidden>
              {name
                .trim()
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("") || "?"}
            </span>
            <div>
              <Button variant="outline" size="sm" onClick={() => toast.success("Photo upload simulated", { description: "In the full product you could upload a square photo up to 2 MB." })}>
                <Camera className="mr-1.5 size-4" aria-hidden /> Upload photo
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, square. Visible to your team.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-role">Job role</Label>
              <Input
                id="profile-role"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Sales Manager"
                maxLength={60}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={touched && !emailOk}
            />
            {touched && !emailOk ? (
              <p className="text-xs text-red-600" role="alert">
                Enter a valid email address — notifications are sent here.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Used for sign-in and email notifications.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => { setName(user.name); setEmail(user.email); setJobRole(user.jobRole); }}>
          Reset
        </Button>
        <Button onClick={save} disabled={!canSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
