export const ADMIN_ROLES = ['SYSTEM_OWNER', 'SECURITY_ADMINISTRATOR'];

export const ROLE_LABELS: Record<string, string> = {
  SYSTEM_OWNER: 'System owner',
  SECURITY_ADMINISTRATOR: 'Security administrator',
  SECURITY_ANALYST: 'Security analyst',
  NETWORK_ADMINISTRATOR: 'Network administrator',
  IT_SUPPORT: 'IT support',
  AUDITOR: 'Auditor',
  DATA_PROTECTION_OFFICER: 'Data protection officer',
  HOTEL_MANAGEMENT: 'Hotel management',
  READ_ONLY_EXECUTIVE: 'Executive',
};

export const ROLE_FOCUS: Record<string, string> = {
  SYSTEM_OWNER: 'You provision staff accounts and can review every security area for the hotel.',
  SECURITY_ADMINISTRATOR: 'You create staff accounts and oversee the hotel security workspace.',
  SECURITY_ANALYST: 'Review open security events and incidents for the property.',
  NETWORK_ADMINISTRATOR: 'Watch guest and staff network devices and anything that needs attention.',
  IT_SUPPORT: 'Follow devices that need attention and the incidents assigned to operations.',
  AUDITOR: 'Review the audit trail of sign-ins and staff changes.',
  DATA_PROTECTION_OFFICER: 'Check the privacy and retention policies in force at the hotel.',
  HOTEL_MANAGEMENT: 'See open incidents and the policies that affect guests and staff.',
  READ_ONLY_EXECUTIVE: 'A read-only view of the hotel security posture.',
};

export function isAdmin(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
