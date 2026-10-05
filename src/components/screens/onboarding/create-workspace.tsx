"use client";
// Screen 12 — Create Business Workspace. Minimal: we only ask for what we need.

import React, { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { TrustRow } from "./parts";

const COUNTRIES = [
  { value: "Nigeria", currency: "₦ (Nigerian Naira)" },
  { value: "Ghana", currency: "GH₵ (Ghanaian Cedi)" },
  { value: "Kenya", currency: "KSh (Kenyan Shilling)" },
  { value: "South Africa", currency: "R (South African Rand)" },
  { value: "United Kingdom", currency: "£ (British Pound)" },
  { value: "United States", currency: "$ (US Dollar)" },
];

export default function CreateWorkspace(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const createWorkspace = useBizz((s) => s.createWorkspace);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [currency, setCurrency] = useState("₦ (Nigerian Naira)");
  const [website, setWebsite] = useState("");
  const [touchedCurrency, setTouchedCurrency] = useState(false);
  const [error, setError] = useState("");

  function onCountryChange(v: string) {
    setCountry(v);
    if (!touchedCurrency) {
      const match = COUNTRIES.find((c) => c.value === v);
      if (match) setCurrency(match.currency);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your workspace a business name — you can change it later.");
      return;
    }
    setError("");
    createWorkspace({
      name: name.trim(),
      type: "service",
      country,
      currency,
      website: website.trim() || undefined,
    });
    navigate("checkup-intro");
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-slate-500" onClick={() => navigate("welcome")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to start options
      </Button>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Create your business workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We only ask for what we need. Everything else is learned during the checkup.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Business name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ShineCare Cleaning Services"
              aria-required="true"
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error ? (
              <p id="ws-name-error" className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ws-country">Primary country</Label>
              <Select value={country} onValueChange={onCountryChange}>
                <SelectTrigger id="ws-country" aria-label="Primary country">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => {
                  setTouchedCurrency(true);
                  setCurrency(v);
                }}
              >
                <SelectTrigger id="ws-currency" aria-label="Currency">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.currency} value={c.currency}>
                      {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-website">
              Website <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ws-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              type="url"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">Used later to check tracking — never required.</p>
          </div>

          <Button type="submit" className="w-full sm:w-auto">
            Continue to the private checkup
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <p className="text-xs text-muted-foreground">
            Next step: a short conversation so the first diagnosis understands your business.
          </p>
        </form>
      </Card>

      <TrustRow className="mt-6" />
    </div>
  );
}
