import "server-only";

/** Database-backed roles are the only source of platform-administrator access. */
const PLATFORM_ADMIN_ROLES = new Set(["ADMIN", "PLATFORM_ADMIN", "SUPER_ADMIN"]);

export interface PlatformAdminSubject {
  platformRole: string;
}

export function isPlatformAdmin(subject: PlatformAdminSubject): boolean {
  const role = subject.platformRole.trim().toUpperCase();
  return PLATFORM_ADMIN_ROLES.has(role);
}
