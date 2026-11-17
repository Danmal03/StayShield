import { SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma.service';
import { OperationsService } from '../src/operations/operations.service';

describe('OperationsService audit flags', () => {
  const actor: AuthenticatedUser = {
    id: 'admin-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    email: 'admin@example.test',
    displayName: 'Admin',
    roles: [SystemRole.SECURITY_ADMINISTRATOR],
  };
  const auditLog = { groupBy: jest.fn() };
  const user = { findMany: jest.fn() };
  const service = new OperationsService({ auditLog, user } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flags only users who meet a recent activity threshold', async () => {
    const occurredAt = new Date();
    auditLog.groupBy
      .mockResolvedValueOnce([{ actorId: 'user-1', _count: { _all: 4 }, _max: { createdAt: occurredAt } }])
      .mockResolvedValueOnce([{ actorId: 'user-1', _count: { _all: 3 }, _max: { createdAt: occurredAt } }])
      .mockResolvedValueOnce([{ actorId: 'user-2', _count: { _all: 10 }, _max: { createdAt: occurredAt } }]);
    user.findMany.mockResolvedValue([
      { id: 'user-1', displayName: 'Staff One' },
      { id: 'user-2', displayName: 'Staff Two' },
    ]);

    await expect(service.listAuditFlags(actor)).resolves.toEqual([
      {
        userId: 'user-1',
        displayName: 'Staff One',
        signals: [{
          type: 'denied_requests',
          count: 3,
          threshold: 3,
          windowMinutes: 10,
          lastOccurredAt: occurredAt,
        }],
      },
      {
        userId: 'user-2',
        displayName: 'Staff Two',
        signals: [{
          type: 'record_changes',
          count: 10,
          threshold: 10,
          windowMinutes: 5,
          lastOccurredAt: occurredAt,
        }],
      },
    ]);
    expect(user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1', 'user-2'] }, tenantId: actor.tenantId },
      select: { id: true, displayName: true },
    });
  });
});
