import { SystemRole } from '@prisma/client';

export const ADMIN_ROLES: SystemRole[] = [
  SystemRole.SYSTEM_OWNER,
  SystemRole.SECURITY_ADMINISTRATOR,
];

export function isAdmin(roles: readonly string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role as SystemRole));
}

export function canAccess(roles: readonly string[], allowed: SystemRole[]): boolean {
  return isAdmin(roles) || roles.some((role) => allowed.includes(role as SystemRole));
}
