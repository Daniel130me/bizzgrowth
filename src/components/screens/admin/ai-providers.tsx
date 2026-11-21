"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { ErrorState, LoadingState } from "@/components/shared/states";
import type { AdminAiCredential, AdminAiProviderConfig, ManagedAiProviderId } from "@/lib/ai-provider-config";

const PROVIDER_META: Record<ManagedAiProviderId, { label: string; defaultModel: string }> = {
  "z.ai": { label: "z.ai", defaultModel: "glm-4.7-flash" },
  openai: { label: "OpenAI", defaultModel: "gpt-4o-mini" },
  groq: { label: "Groq", defaultModel: "llama-3.3-70b-versatile" },
  openrouter: { label: "OpenRouter", defaultModel: "google/gemini-2.0-flash-001" },
  gemini: { label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
};

type ProviderResponse = {
  ok?: boolean;
  encryptionReady?: boolean;
  providers?: AdminAiProviderConfig[];
  error?: string;
};

async function requestJson(url: string, init?: RequestInit): Promise<ProviderResponse> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const json = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok || !json.ok) throw new Error(json.error || "The AI provider change could not be saved.");
  return json;
}

export function AiProviderManagement() {
  const [providers, setProviders] = useState<AdminAiProviderConfig[]>([]);
  const [models, setModels] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ provider: ManagedAiProviderId; credential: AdminAiCredential } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const json = await requestJson("/api/admin/ai-providers", { cache: "no-store" });
      const nextProviders = json.providers ?? [];
      setProviders(nextProviders);
      setEncryptionReady(json.encryptionReady === true);
      setModels(Object.fromEntries(nextProviders.map((provider) => [provider.provider, provider.model ?? ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI provider configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProvider(provider: AdminAiProviderConfig, enabled = provider.enabled) {
    const action = `provider:${provider.provider}`;
    setWorking(action);
    try {
      await requestJson("/api/admin/ai-providers", {
        method: "PUT",
        body: JSON.stringify({ provider: provider.provider, enabled, model: models[provider.provider] || null }),
      });
      setProviders((current) =>
        current.map((item) =>
          item.provider === provider.provider ? { ...item, enabled, model: models[provider.provider] || null } : item,
        ),
      );
      toast.success(`${PROVIDER_META[provider.provider].label} updated`);
    } catch (caught) {
      toast.error("Provider not updated", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  async function addKey(provider: AdminAiProviderConfig) {
    const label = (labels[provider.provider] ?? "").trim();
    const apiKey = (keys[provider.provider] ?? "").trim();
    if (label.length < 2 || apiKey.length < 12) {
      toast.error("Complete the key details", { description: "Add a clear label and a valid API key." });
      return;
    }
    const action = `add:${provider.provider}`;
    setWorking(action);
    try {
      await requestJson("/api/admin/ai-providers", {
        method: "POST",
        body: JSON.stringify({ provider: provider.provider, label, apiKey }),
      });
      setLabels((current) => ({ ...current, [provider.provider]: "" }));
      setKeys((current) => ({ ...current, [provider.provider]: "" }));
      await load();
      toast.success("API key added", { description: "It is encrypted and available to the failover gateway." });
    } catch (caught) {
      toast.error("API key not added", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  async function setKeyEnabled(credential: AdminAiCredential, enabled: boolean) {
    const action = `key:${credential.id}`;
    setWorking(action);
    try {
      await requestJson("/api/admin/ai-providers", {
        method: "PATCH",
        body: JSON.stringify({ id: credential.id, enabled }),
      });
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          credentials: provider.credentials.map((item) => (item.id === credential.id ? { ...item, enabled } : item)),
        })),
      );
      toast.success(enabled ? "API key enabled" : "API key disabled");
    } catch (caught) {
      toast.error("API key not updated", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  async function deleteKey() {
    if (!deleteTarget) return;
    const { credential } = deleteTarget;
    setWorking(`delete:${credential.id}`);
    try {
      await requestJson(`/api/admin/ai-providers?id=${encodeURIComponent(credential.id)}`, { method: "DELETE" });
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          credentials: provider.credentials.filter((item) => item.id !== credential.id),
        })),
      );
      setDeleteTarget(null);
      toast.success("API key removed");
    } catch (caught) {
      toast.error("API key not removed", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI providers"
        description="Add encrypted API keys, choose models, and control which providers the platform may use."
      />

      {!encryptionReady && !loading ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p className="font-semibold">Key storage is unavailable</p>
          <p className="mt-1 text-red-800">
            Configure AI_CREDENTIALS_ENCRYPTION_KEY on the server before adding API keys. Existing environment keys keep working.
          </p>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Loading AI providers" rows={5} />
      ) : error ? (
        <ErrorState title="AI providers unavailable" description={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider.provider];
            const providerWorking = working === `provider:${provider.provider}`;
            return (
              <SectionCard
                key={provider.provider}
                title={meta.label}
                description={provider.enabled ? "Available to the failover gateway." : "Excluded from every AI request."}
                action={
                  <div className="flex items-center gap-2">
                    <Badge variant={provider.enabled ? "default" : "outline"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
                    <Switch
                      checked={provider.enabled}
                      disabled={Boolean(working)}
                      aria-label={`Enable ${meta.label}`}
                      onCheckedChange={(enabled) => void saveProvider(provider, enabled)}
                    />
                  </div>
                }
              >
                <div className="space-y-5">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor={`model-${provider.provider}`}>Model override</Label>
                      <Input
                        id={`model-${provider.provider}`}
                        value={models[provider.provider] ?? ""}
                        placeholder={`Default: ${meta.defaultModel}`}
                        maxLength={120}
                        onChange={(event) => setModels((current) => ({ ...current, [provider.provider]: event.target.value }))}
                      />
                    </div>
                    <Button variant="outline" disabled={Boolean(working)} onClick={() => void saveProvider(provider)}>
                      {providerWorking ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                      Save model
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Stored API keys</p>
                        <p className="text-xs text-muted-foreground">Only the label and final four characters are shown after saving.</p>
                      </div>
                      <Badge variant="outline">{provider.credentials.length}</Badge>
                    </div>
                    {provider.credentials.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No administrator-managed keys.</p>
                    ) : (
                      <ul className="space-y-2">
                        {provider.credentials.map((credential) => (
                          <li key={credential.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                            <KeyRound className="size-4 text-slate-400" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{credential.label}</p>
                              <p className="font-mono text-xs text-muted-foreground">{credential.masked}</p>
                            </div>
                            <Switch
                              checked={credential.enabled}
                              disabled={Boolean(working)}
                              aria-label={`Enable key ${credential.label}`}
                              onCheckedChange={(enabled) => void setKeyEnabled(credential, enabled)}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={Boolean(working)}
                              aria-label={`Delete key ${credential.label}`}
                              onClick={() => setDeleteTarget({ provider: provider.provider, credential })}
                            >
                              <Trash2 className="size-4 text-red-600" aria-hidden />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Plus className="size-4" aria-hidden /> Add API key
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(12rem,1.3fr)_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor={`label-${provider.provider}`}>Label</Label>
                        <Input
                          id={`label-${provider.provider}`}
                          value={labels[provider.provider] ?? ""}
                          placeholder="Production key"
                          maxLength={60}
                          onChange={(event) => setLabels((current) => ({ ...current, [provider.provider]: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`key-${provider.provider}`}>Secret API key</Label>
                        <Input
                          id={`key-${provider.provider}`}
                          type="password"
                          autoComplete="off"
                          value={keys[provider.provider] ?? ""}
                          placeholder="Paste the provider key"
                          maxLength={1000}
                          onChange={(event) => setKeys((current) => ({ ...current, [provider.provider]: event.target.value }))}
                        />
                      </div>
                      <Button
                        disabled={!encryptionReady || Boolean(working)}
                        onClick={() => void addKey(provider)}
                      >
                        {working === `add:${provider.provider}` ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                        Add key
                      </Button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border bg-white p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
        Keys are encrypted with AES-256-GCM before storage. Plaintext keys are never returned by the API or shown again.
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.credential.label} (${deleteTarget.credential.masked}) will be permanently removed. Requests will use another enabled key or provider.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working.startsWith("delete:")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={working.startsWith("delete:")}
              onClick={(event) => {
                event.preventDefault();
                void deleteKey();
              }}
            >
              {working.startsWith("delete:") ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Remove key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
