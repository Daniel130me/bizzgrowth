import "server-only";

/**
 * Database roles remain the source of truth. The email allowlist provides a
 * deployment bootstrap path before a role-management screen exists.
 */
const PLATFORM_ADMIN_ROLES = new Set(["ADMIN", "PLATFORM_ADMIN", "SUPER_ADMIN"]);

export interface PlatformAdminSubject {
  email: string;
  platformRole: string;
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(subject: PlatformAdminSubject): boolean {
  const role = subject.platformRole.trim().toUpperCase();
  if (PLATFORM_ADMIN_ROLES.has(role)) return true;
  return configuredAdminEmails().has(subject.email.trim().toLowerCase());
}
