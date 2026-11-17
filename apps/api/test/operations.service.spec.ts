import { ConflictException, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma.service';
import { OperationsService } from '../src/operations/operations.service';

describe('OperationsService device quarantine', () => {
  const deviceId = '20a4a345-58f4-4a43-92ce-75f743118df7';
  const actor: AuthenticatedUser = {
    id: 'f4c55913-2e6a-4f16-8a4d-b92db4d44371',
    sessionId: 'session-id',
    tenantId: '4bc408e5-05ec-4d3e-83d9-84de8b05dbe4',
    email: 'admin@example.test',
    displayName: 'Admin',
    roles: [SystemRole.SECURITY_ADMINISTRATOR],
  };
  const transaction = {
    networkDevice: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((work: (tx: typeof transaction) => unknown) => work(transaction)),
  };
  const service = new OperationsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('quarantines without deleting and audits the action', async () => {
    transaction.networkDevice.findFirst.mockResolvedValue({ id: deviceId, status: 'online' });
    transaction.networkDevice.updateMany.mockResolvedValue({ count: 1 });
    transaction.networkDevice.findFirstOrThrow.mockResolvedValue({ id: deviceId, status: 'quarantined' });
    transaction.auditLog.create.mockResolvedValue({});

    await service.quarantineDevice(actor, deviceId);

    expect(transaction.networkDevice.updateMany).toHaveBeenCalledWith({
      where: { id: deviceId, tenantId: actor.tenantId, status: 'online' },
      data: { status: 'quarantined' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'device.quarantined', targetId: deviceId }),
    }));
  });

  it('restores quarantined devices to online and records the resolution', async () => {
    transaction.networkDevice.updateMany.mockResolvedValue({ count: 1 });
    transaction.networkDevice.findFirstOrThrow.mockResolvedValue({ id: deviceId, status: 'online' });
    transaction.auditLog.create.mockResolvedValue({});

    await service.restoreDevice(actor, deviceId);

    expect(transaction.networkDevice.updateMany).toHaveBeenCalledWith({
      where: { id: deviceId, tenantId: actor.tenantId, status: 'quarantined' },
      data: expect.objectContaining({ status: 'online', lastSeenAt: expect.any(Date) }),
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'device.restored', targetId: deviceId }),
    }));
  });

  it('requires explicit restoration before a quarantined device can be edited', async () => {
    transaction.networkDevice.findFirst.mockResolvedValue({ id: deviceId, status: 'quarantined' });

    await expect(service.updateDevice(actor, deviceId, { name: 'Updated access point' }))
      .rejects.toThrow(ConflictException);
    expect(transaction.networkDevice.updateMany).not.toHaveBeenCalled();
  });

  it('returns not found when restoring a device outside the tenant', async () => {
    transaction.networkDevice.updateMany.mockResolvedValue({ count: 0 });
    transaction.networkDevice.findFirst.mockResolvedValue(null);

    await expect(service.restoreDevice(actor, deviceId)).rejects.toThrow(NotFoundException);
  });
});
