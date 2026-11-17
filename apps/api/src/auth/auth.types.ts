import { Request } from 'express';
import { SystemRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: SystemRole[];
}

export interface AuthenticatedRequest extends Request {
  auth: AuthenticatedUser;
}

export type RoleAssignmentView = { tenantId: string; role: SystemRole };

export function rolesForTenant(
  assignments: RoleAssignmentView[],
  tenantId: string,
): SystemRole[] {
  return assignments
    .filter((assignment) => assignment.tenantId === tenantId)
    .map((assignment) => assignment.role);
}
