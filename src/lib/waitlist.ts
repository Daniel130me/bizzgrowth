import { isEmail, normaliseEmail, str } from "@/lib/auth/http";

export const WAITLIST_EXPERIENCE_OPTIONS = ["Less than 1 year", "1–3 years", "4–7 years", "8+ years"] as const;
export type WaitlistExperience = (typeof WAITLIST_EXPERIENCE_OPTIONS)[number];
export type WaitlistAudience = "business" | "specialist";

export interface WaitlistSubmission {
  name: string;
  email: string;
  audience: WaitlistAudience;
  businessName: string | null;
  industry: string | null;
  specialty: string | null;
  experience: WaitlistExperience | null;
}

export type WaitlistValidation =
  | { ok: true; value: WaitlistSubmission }
  | { ok: false; error: string; field: string };

export function validateWaitlistSubmission(body: Record<string, unknown> | null): WaitlistValidation {
  const name = str(body?.name, 120).trim();
  const email = normaliseEmail(body?.email);
  const audience = body?.audience;

  if (name.length < 2) return { ok: false, error: "Enter your full name.", field: "name" };
  if (email.length > 254 || !isEmail(email)) return { ok: false, error: "Enter a valid email address.", field: "email" };
  if (audience !== "business" && audience !== "specialist") {
    return { ok: false, error: "Choose whether you are joining as a business or specialist.", field: "audience" };
  }

  if (audience === "business") {
    const businessName = str(body?.businessName, 140).trim();
    const industry = str(body?.industry, 120).trim();
    if (businessName.length < 2) return { ok: false, error: "Enter your business name.", field: "businessName" };
    if (industry.length < 2) return { ok: false, error: "Enter your industry.", field: "industry" };
    return {
      ok: true,
      value: { name, email, audience, businessName, industry, specialty: null, experience: null },
    };
  }

  const specialty = str(body?.specialty, 140).trim();
  const experience = body?.experience;
  if (specialty.length < 2) return { ok: false, error: "Enter your area of expertise.", field: "specialty" };
  const validExperience = WAITLIST_EXPERIENCE_OPTIONS.find((option) => option === experience);
  if (!validExperience) {
    return { ok: false, error: "Choose your years of experience.", field: "experience" };
  }
  return {
    ok: true,
    value: {
      name,
      email,
      audience,
      businessName: null,
      industry: null,
      specialty,
      experience: validExperience,
    },
  };
}
