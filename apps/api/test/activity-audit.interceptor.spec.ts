import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ActivityAuditInterceptor } from '../src/audit/activity-audit.interceptor';
import { PrismaService } from '../src/prisma.service';

describe('ActivityAuditInterceptor', () => {
  const auditLog = { create: jest.fn().mockResolvedValue({}) };
  const interceptor = new ActivityAuditInterceptor({ auditLog } as unknown as PrismaService);
  const next = { handle: jest.fn().mockReturnValue(of({ result: 'ok' })) } as unknown as CallHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    next.handle = jest.fn().mockReturnValue(of({ result: 'ok' }));
  });

  it('records authenticated GET route reads without query parameters', async () => {
    const request = {
      method: 'GET',
      baseUrl: '/api/operations',
      path: '/incidents',
      route: { path: '/incidents' },
      ip: '127.0.0.1',
      auth: { id: 'user-id', tenantId: 'tenant-id' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toEqual({ result: 'ok' });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-id',
        actorId: 'user-id',
        action: 'system.viewed',
        targetType: 'API route',
        targetId: '/api/operations/incidents',
        sourceIp: '127.0.0.1',
        metadata: { method: 'GET' },
      },
    });
  });

  it('does not record writes or unauthenticated reads', async () => {
    const contextFor = (request: object) => ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

    await firstValueFrom(interceptor.intercept(contextFor({ method: 'POST', auth: { id: 'user-id' } }), next));
    await firstValueFrom(interceptor.intercept(contextFor({ method: 'GET' }), next));

    expect(auditLog.create).not.toHaveBeenCalled();
  });
});
