import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/auth/roles.guard';
import { PrismaService } from '../src/prisma.service';

describe('RolesGuard', () => {
  function makeContext(roles: SystemRole[]): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            id: 'user-id',
            tenantId: 'tenant-id',
            roles,
          },
          baseUrl: '/api/operations',
          path: '/devices',
          ip: '127.0.0.1',
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('denies a user without a required role and records the denial', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([SystemRole.SECURITY_ADMINISTRATOR]),
    } as unknown as Reflector;
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const guard = new RolesGuard(reflector, { auditLog } as unknown as PrismaService);

    await expect(guard.canActivate(makeContext([SystemRole.IT_SUPPORT]))).rejects.toThrow(
      ForbiddenException,
    );
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'permission.denied' }),
    }));
  });

  it('allows a user with a required role', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([SystemRole.SECURITY_ADMINISTRATOR]),
    } as unknown as Reflector;
    const guard = new RolesGuard(
      reflector,
      { auditLog: { create: jest.fn() } } as unknown as PrismaService,
    );

    await expect(guard.canActivate(makeContext([SystemRole.SECURITY_ADMINISTRATOR]))).resolves.toBe(true);
  });
});
