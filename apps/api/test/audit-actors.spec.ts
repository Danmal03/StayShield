import { BadRequestException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma.service';
import { OperationsService } from '../src/operations/operations.service';

describe('OperationsService audit actors', () => {
  const actor: AuthenticatedUser = {
    id: 'admin-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    email: 'admin@example.test',
    displayName: 'Admin',
    roles: [SystemRole.SECURITY_ADMINISTRATOR],
  };
  const user = { findMany: jest.fn(), findFirst: jest.fn() };
  const auditLog = { groupBy: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() };
  const service = new OperationsService({ user, auditLog } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists every tenant account in administrator or user group with action counts', async () => {
    user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        displayName: 'Hotel Admin',
        email: 'admin@hotel.test',
        roleAssignments: [{ role: SystemRole.SECURITY_ADMINISTRATOR }],
      },
      {
        id: 'staff-1',
        displayName: 'Hotel Staff',
        email: 'staff@hotel.test',
        roleAssignments: [{ role: SystemRole.IT_SUPPORT }],
      },
    ]);
    auditLog.groupBy.mockResolvedValue([
      { actorId: 'admin-1', _count: { _all: 4 } },
      { actorId: 'staff-1', _count: { _all: 2 } },
    ]);

    await expect(service.listAuditActors(actor)).resolves.toEqual({
      administrators: [{
        id: 'admin-1',
        displayName: 'Hotel Admin',
        email: 'admin@hotel.test',
        roles: [SystemRole.SECURITY_ADMINISTRATOR],
        actionCount: 4,
      }],
      users: [{
        id: 'staff-1',
        displayName: 'Hotel Staff',
        email: 'staff@hotel.test',
        roles: [SystemRole.IT_SUPPORT],
        actionCount: 2,
      }],
    });
    expect(user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: actor.tenantId },
    }));
    expect(auditLog.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: actor.tenantId, actorId: { not: null } },
    }));
  });

  it('paginates actor history and returns the next cursor', async () => {
    user.findFirst.mockResolvedValue({ id: 'staff-1' });
    const records = Array.from({ length: 51 }, (_, index) => ({
      id: `record-${index}`,
      createdAt: new Date(2026, 0, index + 1),
    }));
    auditLog.findMany.mockResolvedValue(records);

    const result = await service.listActorAudit(actor, 'staff-1');

    expect(result.entries).toHaveLength(50);
    expect(result.nextCursor).toBe('record-49');
    expect(auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: actor.tenantId, actorId: 'staff-1' },
      take: 51,
    }));
  });

  it('rejects a cursor that does not belong to this actor and tenant', async () => {
    user.findFirst.mockResolvedValue({ id: 'staff-1' });
    auditLog.findFirst.mockResolvedValue(null);

    await expect(service.listActorAudit(actor, 'staff-1', 'cursor-id'))
      .rejects.toThrow(BadRequestException);
    expect(auditLog.findMany).not.toHaveBeenCalled();
  });
});
