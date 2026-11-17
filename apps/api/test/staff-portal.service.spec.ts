import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { AuthenticatedUser } from '../src/auth/auth.types';
import { StaffPortalService } from '../src/staff-portal/staff-portal.service';

const actor: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000010',
  sessionId: '00000000-0000-4000-8000-000000000011',
  tenantId: '00000000-0000-4000-8000-000000000001',
  email: 'employee@example.test',
  displayName: 'Employee Example',
  roles: [],
};

describe('StaffPortalService ownership scoping', () => {
  it('scopes request listing by both authenticated user and tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new StaffPortalService({
      staffRequest: { findMany },
    } as unknown as PrismaService);

    await service.listOwnRequests(actor);

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, userId: actor.id },
      include: { assignedAdmin: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('cannot mark another employee’s notification as read', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new StaffPortalService({
      staffNotification: { updateMany },
    } as unknown as PrismaService);

    await expect(service.markNotificationRead(actor, '00000000-0000-4000-8000-000000000012'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000012',
        tenantId: actor.tenantId,
        userId: actor.id,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('creates reports using the authenticated identity rather than client ownership', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'report-id' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      incident: { create },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      staffSecurityProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new StaffPortalService(prisma as unknown as PrismaService);

    await service.createSecurityReport(actor, {
      category: 'suspicious_email',
      title: 'Unexpected payroll link',
      description: 'The email asks me to sign in on an unfamiliar page.',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        reporterUserId: actor.id,
        reportCategory: 'suspicious_email',
      }),
    });
  });

  it('creates a support request with server-derived tenant and user ownership', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'request-id' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      staffRequest: { create },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      staffSecurityProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new StaffPortalService(prisma as unknown as PrismaService);

    await service.createRequest(actor, {
      category: 'general_it_support',
      description: 'Please help me reconnect to the staff printer.',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: actor.tenantId, userId: actor.id }),
    });
  });

  it('cannot submit training for an assignment belonging to another user or tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new StaffPortalService({
      staffSecurityProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      trainingAssignment: { findFirst },
    } as unknown as PrismaService);

    await expect(service.submitTraining(actor, '00000000-0000-4000-8000-000000000013', { answers: [0] }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000013',
        tenantId: actor.tenantId,
        userId: actor.id,
      },
      include: { course: true },
    });
  });

  it('revokes only a different session belonging to the authenticated user', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new StaffPortalService({
      session: { deleteMany },
    } as unknown as PrismaService);
    const sessionId = '00000000-0000-4000-8000-000000000014';

    await service.revokeSession(actor, sessionId);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: sessionId, userId: actor.id },
    });
  });

  it('deletes only tenant-owned departments and archives department-only announcements', async () => {
    const departmentId = '00000000-0000-4000-8000-000000000016';
    const tx = {
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: departmentId }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityAnnouncement: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new StaffPortalService(prisma as unknown as PrismaService);

    await service.deleteDepartment(actor, departmentId);

    expect(tx.securityAnnouncement.updateMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, audienceDepartmentId: departmentId },
      data: { isActive: false },
    });
    expect(tx.department.deleteMany).toHaveBeenCalledWith({
      where: { id: departmentId, tenantId: actor.tenantId },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'department.deleted', targetId: departmentId }),
    }));
  });

  it('scopes personal devices to the authenticated employee and tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new StaffPortalService({
      personalDevice: { findMany },
    } as unknown as PrismaService);

    await service.listDevices(actor);

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, userId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('stores a website access request as a user-owned approval workflow', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'website-request-id' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      staffRequest: { create },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      staffSecurityProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new StaffPortalService(prisma as unknown as PrismaService);

    await service.createRequest(actor, {
      category: 'website_access',
      website: 'https://work.example.test',
      websiteCategory: 'Work',
      description: 'Required to access the staff scheduling service.',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        userId: actor.id,
        category: 'website_access',
        website: 'https://work.example.test',
      }),
    });
  });

  it('calculates training results on the server and persists them to the own assignment', async () => {
    const assignmentId = '00000000-0000-4000-8000-000000000015';
    const findFirst = jest.fn().mockResolvedValue({
      id: assignmentId,
      course: {
        passingScore: 80,
        questions: [
          { prompt: 'Question one?', options: ['Correct', 'Incorrect'], answerIndex: 0 },
          { prompt: 'Question two?', options: ['Correct', 'Incorrect'], answerIndex: 0 },
        ],
      },
    });
    const upsert = jest.fn().mockResolvedValue({
      id: 'completion-id',
      completedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const tx = {
      trainingCompletion: { upsert },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      staffSecurityProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      trainingAssignment: { findFirst },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new StaffPortalService(prisma as unknown as PrismaService);

    await expect(service.submitTraining(actor, assignmentId, { answers: [0, 1] })).resolves.toMatchObject({
      score: 50,
      passed: false,
      passingScore: 80,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: assignmentId, tenantId: actor.tenantId, userId: actor.id },
      include: { course: true },
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { assignmentId },
      create: { assignmentId, userId: actor.id, score: 50, passed: false },
      update: { userId: actor.id, score: 50, passed: false, completedAt: expect.any(Date) },
    });
  });

  it('updates only the authenticated employee’s notification', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new StaffPortalService({
      staffNotification: { updateMany },
    } as unknown as PrismaService);
    const notificationId = '00000000-0000-4000-8000-000000000016';

    await service.markNotificationRead(actor, notificationId);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, tenantId: actor.tenantId, userId: actor.id },
      data: { readAt: expect.any(Date) },
    });
  });

  it('enforces department-configured permissions before accepting requests', async () => {
    const transaction = jest.fn();
    const service = new StaffPortalService({
      staffSecurityProfile: {
        findFirst: jest.fn().mockResolvedValue({
          department: { isActive: true, permissions: ['training'] },
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(service.createRequest(actor, {
      category: 'general_it_support',
      description: 'Please help with a work application.',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
