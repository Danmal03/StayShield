import 'reflect-metadata';
import { SystemRole } from '@prisma/client';
import { REQUIRED_ROLES } from '../src/auth/auth.constants';
import { StaffPortalController } from '../src/staff-portal/staff-portal.controller';

describe('StaffPortalController permissions', () => {
  it('limits cross-employee request review to administrators', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, StaffPortalController.prototype.updateRequest)).toEqual([
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
    ]);
  });

  it('limits device approval to administrators', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, StaffPortalController.prototype.reviewDevice)).toEqual([
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
    ]);
  });

  it('limits department deletion to administrators', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, StaffPortalController.prototype.deleteDepartment)).toEqual([
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
    ]);
  });

  it('allows authenticated employees to read only their own portal overview', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, StaffPortalController.prototype.overview)).toBeUndefined();
  });
});
