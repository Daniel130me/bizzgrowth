export type MarketplaceRole = "owner" | "specialist";

export type EngagementTransition = {
  role: MarketplaceRole;
  from: readonly string[];
  to: string;
};

export const ENGAGEMENT_TRANSITIONS: Readonly<Record<string, EngagementTransition>> = {
  accept: { role: "specialist", from: ["awarded"], to: "accepted" },
  start: { role: "specialist", from: ["accepted"], to: "in-progress" },
  deliver: { role: "specialist", from: ["in-progress"], to: "delivered" },
  complete: { role: "owner", from: ["delivered"], to: "completed" },
  cancel: { role: "owner", from: ["awarded", "accepted"], to: "cancelled" },
  dispute: { role: "owner", from: ["in-progress", "delivered"], to: "disputed" },
};

export function engagementTransition(action: string): EngagementTransition | null {
  return ENGAGEMENT_TRANSITIONS[action] ?? null;
}

export type ValidBidInput = { amount: number; days: number; coverNote: string };

export function validateBidInput(body: unknown): { value?: ValidBidInput; error?: string } {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const amount = Math.round(Number(input.amount));
  const days = Math.round(Number(input.days));
  const coverNote = typeof input.coverNote === "string" ? input.coverNote.trim().slice(0, 3000) : "";
  if (!Number.isFinite(amount) || amount < 1_000 || amount > 1_000_000_000) {
    return { error: "Enter a valid total bid amount." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "Delivery time must be between 1 and 365 days." };
  }
  if (coverNote.length < 40) {
    return { error: "Explain your approach in at least 40 characters." };
  }
  return { value: { amount, days, coverNote } };
}
