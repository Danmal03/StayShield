import 'reflect-metadata';
import { SystemRole } from '@prisma/client';
import { REQUIRED_ROLES } from '../src/auth/auth.constants';
import { OperationsController } from '../src/operations/operations.controller';

describe('OperationsController permissions', () => {
  it('limits device creation to system owners and security administrators', () => {
    const roles = Reflect.getMetadata(
      REQUIRED_ROLES,
      OperationsController.prototype.createDevice,
    );

    expect(roles).toEqual([
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
    ]);
  });

  it('limits quarantining and restoring devices to administrators', () => {
    for (const action of ['quarantineDevice', 'restoreDevice'] as const) {
      const roles = Reflect.getMetadata(REQUIRED_ROLES, OperationsController.prototype[action]);

      expect(roles).toEqual([
        SystemRole.SYSTEM_OWNER,
        SystemRole.SECURITY_ADMINISTRATOR,
      ]);
    }
  });
});
