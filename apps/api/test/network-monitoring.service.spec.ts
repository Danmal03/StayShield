import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { AuthenticatedUser } from '../src/auth/auth.types';
import { NetworkMonitoringService } from '../src/network-monitoring/network-monitoring.service';

const actor: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000010',
  sessionId: '00000000-0000-4000-8000-000000000011',
  tenantId: '00000000-0000-4000-8000-000000000001',
  email: 'employee@example.test',
  displayName: 'Employee Example',
  roles: [],
};

describe('NetworkMonitoringService', () => {
  it('scopes current connections to the authenticated employee and hides stale SSIDs', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: 'connected',
        lastSeenAt: new Date(Date.now() - 10 * 60_000),
        integration: { isEnabled: true },
      });
    const service = new NetworkMonitoringService({
      networkConnectionSession: { findFirst },
    } as unknown as PrismaService);

    await expect(service.current(actor)).resolves.toMatchObject({
      status: 'unverified',
      connection: null,
    });

    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        tenantId: actor.tenantId,
        employeeId: actor.id,
        verificationStatus: 'verified',
      }),
    }));
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ tenantId: actor.tenantId, employeeId: actor.id }),
    }));
  });

  it('reports disconnected only after a recent verified provider disconnect event', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: 'disconnected',
        lastSeenAt: new Date(),
        integration: { isEnabled: true },
      });
    const service = new NetworkMonitoringService({
      networkConnectionSession: { findFirst },
    } as unknown as PrismaService);

    await expect(service.current(actor)).resolves.toMatchObject({
      status: 'disconnected',
      connection: null,
    });
  });

  it('returns a fresh verified provider session without accepting a client-supplied identity', async () => {
    const connection = {
      id: 'connection-id',
      source: 'wifi_controller',
      connectionType: 'wifi',
      ssid: 'Actual-Staff-SSID',
      carrierName: null,
      ipAddress: '192.0.2.15',
      networkSegment: 'staff',
      accessPoint: 'AP-12',
      securityStatus: 'not_available',
      status: 'connected',
      verificationStatus: 'verified',
      connectedAt: new Date(),
      disconnectedAt: null,
      lastSeenAt: new Date(),
    };
    const findFirst = jest.fn().mockResolvedValue(connection);
    const service = new NetworkMonitoringService({
      networkConnectionSession: { findFirst },
    } as unknown as PrismaService);

    await expect(service.current(actor)).resolves.toMatchObject({
      status: 'connected',
      connection: { ssid: 'Actual-Staff-SSID', ipAddress: '192.0.2.15' },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ employeeId: actor.id, tenantId: actor.tenantId }),
    }));
  });

  it('returns only the authenticated employee’s own connection history', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new NetworkMonitoringService({
      networkConnectionSession: { findMany },
    } as unknown as PrismaService);

    await service.history(actor);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        employeeId: actor.id,
        verificationStatus: 'verified',
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });
  });

  it('rejects provider events without a valid integration credential', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new NetworkMonitoringService({
      networkIntegration: { findUnique },
    } as unknown as PrismaService);

    await expect(service.ingest(undefined, {
      sourceSessionId: 'controller-session-1',
      eventType: 'connected',
      connectionType: 'wifi',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('disables simulation provider credentials outside development', async () => {
    const originalEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = new NetworkMonitoringService({
      networkIntegration: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'simulation-integration',
          tenantId: actor.tenantId,
          source: 'simulation',
          isEnabled: true,
        }),
      },
    } as unknown as PrismaService);

    try {
      await expect(service.ingest('simulation-token', {
        sourceSessionId: 'sample-session',
        eventType: 'connected',
        connectionType: 'wifi',
      })).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      process.env.NODE_ENV = originalEnvironment;
    }
  });

  it('does not associate a session when the provider identity and registered device disagree', async () => {
    const integration = {
      id: 'integration-id',
      tenantId: actor.tenantId,
      source: 'wifi_controller',
      isEnabled: true,
    };
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({
      id: 'connection-id',
      verificationStatus: data.verificationStatus,
    }));
    const prisma = {
      networkIntegration: {
        findUnique: jest.fn().mockResolvedValue(integration),
        update: jest.fn().mockResolvedValue({}),
      },
      networkConnectionSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: actor.id }) },
      personalDevice: { findFirst: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000020',
        userId: '00000000-0000-4000-8000-000000000021',
      }) },
    };
    const service = new NetworkMonitoringService(prisma as unknown as PrismaService);

    await service.ingest('provider-token', {
      sourceSessionId: 'controller-session-2',
      eventType: 'connected',
      connectionType: 'wifi',
      employeeEmail: actor.email,
      registeredDeviceId: '00000000-0000-4000-8000-000000000020',
      ssid: 'Actual-SSID',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        employeeId: null,
        deviceId: null,
        verificationStatus: 'unverified',
        ssid: 'Actual-SSID',
      }),
    }));
  });

  it('records an SSID change as a new connection-history entry', async () => {
    const previous = {
      id: 'old-connection-id',
      employeeId: actor.id,
      deviceId: null,
      verificationStatus: 'verified',
      status: 'connected',
      connectionType: 'wifi',
      ssid: 'Old-Staff-SSID',
      carrierName: null,
      ipAddress: '192.0.2.15',
      networkSegment: 'staff',
      accessPoint: null,
      securityStatus: 'not_available',
      connectedAt: new Date(Date.now() - 60_000),
      disconnectedAt: null,
      lastSeenAt: new Date(Date.now() - 10_000),
    };
    const close = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({
      id: 'new-connection-id',
      verificationStatus: data.verificationStatus,
    }));
    const service = new NetworkMonitoringService({
      networkIntegration: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'integration-id',
          tenantId: actor.tenantId,
          source: 'wifi_controller',
          isEnabled: true,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      networkConnectionSession: {
        findFirst: jest.fn().mockResolvedValue(previous),
        update: close,
        create,
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: actor.id }) },
    } as unknown as PrismaService);

    await service.ingest('provider-token', {
      sourceSessionId: 'controller-session-3',
      eventType: 'update',
      connectionType: 'wifi',
      employeeEmail: actor.email,
      ssid: 'New-Staff-SSID',
    });

    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-connection-id' },
      data: expect.objectContaining({ status: 'disconnected' }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId: actor.id,
        ssid: 'New-Staff-SSID',
        status: 'connected',
      }),
    }));
  });
});
