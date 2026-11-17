import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { canAccess } from '../auth/access';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import {
  CreateDeviceDto,
  CreateEventDto,
  CreateIncidentDto,
  CreatePolicyDto,
  UpdateDeviceDto,
  UpdateEventDto,
  UpdateIncidentDto,
  UpdatePolicyDto,
} from './operations.dto';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async workspace(actor: AuthenticatedUser) {
    const tenantId = actor.tenantId;
    const [tenant, staff, devicesOnline, devicesAttention, openEvents, openIncidents, policies] =
      await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          include: { properties: { take: 1, orderBy: { createdAt: 'asc' } } },
        }),
        this.prisma.user.count({ where: { tenantId, isActive: true } }),
        this.prisma.networkDevice.count({ where: { tenantId, status: 'online' } }),
        this.prisma.networkDevice.count({ where: { tenantId, status: { not: 'online' } } }),
        this.prisma.securityEvent.count({ where: { tenantId, status: 'open' } }),
        this.prisma.incident.count({ where: { tenantId, status: { not: 'closed' } } }),
        this.prisma.securityPolicy.count({ where: { tenantId } }),
      ]);

    const roles = actor.roles;
    return {
      tenantName: tenant?.name ?? 'Hotel',
      propertyName: tenant?.properties[0]?.name ?? 'Property',
      summary: {
        staff,
        devicesOnline,
        devicesAttention,
        openEvents,
        openIncidents,
        policies,
      },
      devices: canAccess(roles, [
        SystemRole.NETWORK_ADMINISTRATOR,
        SystemRole.IT_SUPPORT,
        SystemRole.READ_ONLY_EXECUTIVE,
      ])
        ? await this.prisma.networkDevice.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
          })
        : null,
      events: canAccess(roles, [
        SystemRole.SECURITY_ANALYST,
        SystemRole.READ_ONLY_EXECUTIVE,
      ])
        ? await this.prisma.securityEvent.findMany({
            where: { tenantId },
            orderBy: { occurredAt: 'desc' },
            take: 20,
          })
        : null,
      policies: canAccess(roles, [
        SystemRole.DATA_PROTECTION_OFFICER,
        SystemRole.HOTEL_MANAGEMENT,
        SystemRole.READ_ONLY_EXECUTIVE,
      ])
        ? await this.prisma.securityPolicy.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
          })
        : null,
      incidents: canAccess(roles, [
        SystemRole.SECURITY_ANALYST,
        SystemRole.IT_SUPPORT,
        SystemRole.HOTEL_MANAGEMENT,
        SystemRole.READ_ONLY_EXECUTIVE,
      ])
        ? await this.prisma.incident.findMany({
            where: { tenantId },
            orderBy: { openedAt: 'desc' },
            take: 20,
          })
        : null,
      audit: canAccess(roles, [SystemRole.AUDITOR])
        ? await this.prisma.auditLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              action: true,
              targetType: true,
              sourceIp: true,
              createdAt: true,
            },
          })
        : null,
    };
  }

  listAudit(actor: AuthenticatedUser) {
    return this.prisma.auditLog.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        sourceIp: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    });
  }

  async listAuditActors(actor: AuthenticatedUser) {
    const [users, actionCounts] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          displayName: true,
          email: true,
          roleAssignments: {
            where: { tenantId: actor.tenantId },
            select: { role: true },
          },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          tenantId: actor.tenantId,
          actorId: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    const countsByActor = new Map(
      actionCounts.flatMap((count) =>
        count.actorId ? [[count.actorId, count._count._all] as const] : [],
      ),
    );
    const actors = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      roles: user.roleAssignments.map((assignment) => assignment.role),
      actionCount: countsByActor.get(user.id) ?? 0,
    }));
    const adminRoles = new Set<SystemRole>([
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
    ]);

    return {
      administrators: actors.filter((user) => user.roles.some((role) => adminRoles.has(role))),
      users: actors.filter((user) => !user.roles.some((role) => adminRoles.has(role))),
    };
  }

  async listActorAudit(actor: AuthenticatedUser, actorId: string, cursor?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    if (cursor) {
      const cursorEntry = await this.prisma.auditLog.findFirst({
        where: { id: cursor, tenantId: actor.tenantId, actorId },
        select: { id: true },
      });
      if (!cursorEntry) throw new BadRequestException('Audit cursor is invalid.');
    }

    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId: actor.tenantId, actorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        sourceIp: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    });
    const hasMore = rows.length > 50;
    const entries = rows.slice(0, 50);
    return {
      entries,
      nextCursor: hasMore ? entries[entries.length - 1]?.id ?? null : null,
    };
  }

  async listAuditFlags(actor: AuthenticatedUser) {
    const now = Date.now();
    const [failedSignIns, deniedRequests, recordChanges] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          tenantId: actor.tenantId,
          actorId: { not: null },
          action: 'auth.login_failed',
          createdAt: { gte: new Date(now - 15 * 60_000) },
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          tenantId: actor.tenantId,
          actorId: { not: null },
          action: 'permission.denied',
          createdAt: { gte: new Date(now - 10 * 60_000) },
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          tenantId: actor.tenantId,
          actorId: { not: null },
          createdAt: { gte: new Date(now - 5 * 60_000) },
          OR: [
            { action: { endsWith: '.created' } },
            { action: { endsWith: '.updated' } },
            { action: { endsWith: '.deleted' } },
            { action: { endsWith: '.quarantined' } },
            { action: { endsWith: '.restored' } },
            { action: { endsWith: '.requested' } },
            { action: { endsWith: '.completed' } },
            { action: { endsWith: '.approved' } },
            { action: { endsWith: '.rejected' } },
            { action: { endsWith: '.revoked' } },
            { action: { endsWith: '.changed' } },
          ],
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    type FlagSignal = {
      type: 'failed_sign_ins' | 'denied_requests' | 'record_changes';
      count: number;
      threshold: number;
      windowMinutes: number;
      lastOccurredAt: Date;
    };
    const signalsByUser = new Map<string, FlagSignal[]>();
    const addSignals = (
      rows: Array<{ actorId: string | null; _count: { _all: number }; _max: { createdAt: Date | null } }>,
      type: FlagSignal['type'],
      threshold: number,
      windowMinutes: number,
    ) => {
      for (const row of rows) {
        if (!row.actorId || row._count._all < threshold || !row._max.createdAt) continue;
        const signals = signalsByUser.get(row.actorId) ?? [];
        signals.push({
          type,
          count: row._count._all,
          threshold,
          windowMinutes,
          lastOccurredAt: row._max.createdAt,
        });
        signalsByUser.set(row.actorId, signals);
      }
    };

    addSignals(failedSignIns, 'failed_sign_ins', 5, 15);
    addSignals(deniedRequests, 'denied_requests', 3, 10);
    addSignals(recordChanges, 'record_changes', 10, 5);

    const userIds = [...signalsByUser.keys()];
    if (!userIds.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: actor.tenantId },
      select: { id: true, displayName: true },
    });
    return users
      .flatMap((user) => {
        const signals = signalsByUser.get(user.id);
        return signals ? [{ userId: user.id, displayName: user.displayName, signals }] : [];
      })
      .sort((left, right) =>
        Math.max(...right.signals.map((signal) => signal.lastOccurredAt.getTime())) -
        Math.max(...left.signals.map((signal) => signal.lastOccurredAt.getTime())),
      );
  }

  listDevices(actor: AuthenticatedUser) {
    return this.prisma.networkDevice.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  createDevice(actor: AuthenticatedUser, input: CreateDeviceDto, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.networkDevice.create({
        data: {
          tenantId: actor.tenantId,
          name: input.name.trim(),
          category: input.category.trim(),
          location: input.location.trim(),
          ipAddress: input.ipAddress,
          status: input.status ?? 'online',
        },
      });
      await this.audit(tx, actor, 'device.created', 'NetworkDevice', device.id, sourceIp);
      return device;
    });
  }

  updateDevice(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateDeviceDto,
    sourceIp?: string,
  ) {
    const data: Prisma.NetworkDeviceUpdateManyMutationInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.category !== undefined) data.category = input.category.trim();
    if (input.location !== undefined) data.location = input.location.trim();
    if (input.ipAddress !== undefined) data.ipAddress = input.ipAddress;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === 'online') data.lastSeenAt = new Date();
    }
    this.requireChanges(data);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.networkDevice.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw new NotFoundException('Device not found.');
      if (existing.status === 'quarantined') {
        throw new ConflictException('Resolve and restore this device before editing it.');
      }
      const updated = await tx.networkDevice.updateMany({
        where: { id, tenantId: actor.tenantId, status: { not: 'quarantined' } },
        data,
      });
      if (!updated.count) {
        const device = await tx.networkDevice.findFirst({
          where: { id, tenantId: actor.tenantId },
          select: { id: true },
        });
        if (!device) throw new NotFoundException('Device not found.');
        throw new ConflictException('Resolve and restore this device before editing it.');
      }
      const device = await tx.networkDevice.findFirstOrThrow({
        where: { id, tenantId: actor.tenantId },
      });
      await this.audit(tx, actor, 'device.updated', 'NetworkDevice', id, sourceIp);
      return device;
    });
  }

  quarantineDevice(actor: AuthenticatedUser, id: string, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.networkDevice.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true, status: true },
      });
      if (!device) throw new NotFoundException('Device not found.');
      if (device.status === 'quarantined') {
        throw new ConflictException('This device is already quarantined.');
      }
      const quarantined = await tx.networkDevice.updateMany({
        where: { id, tenantId: actor.tenantId, status: device.status },
        data: { status: 'quarantined' },
      });
      if (!quarantined.count) throw new ConflictException('The device status changed. Refresh and try again.');
      await this.audit(tx, actor, 'device.quarantined', 'NetworkDevice', id, sourceIp);
      return tx.networkDevice.findFirstOrThrow({ where: { id, tenantId: actor.tenantId } });
    });
  }

  restoreDevice(actor: AuthenticatedUser, id: string, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.networkDevice.updateMany({
        where: { id, tenantId: actor.tenantId, status: 'quarantined' },
        data: { status: 'online', lastSeenAt: new Date() },
      });
      if (!restored.count) {
        const device = await tx.networkDevice.findFirst({
          where: { id, tenantId: actor.tenantId },
          select: { id: true },
        });
        if (!device) throw new NotFoundException('Device not found.');
        throw new ConflictException('Only quarantined devices can be restored.');
      }
      await this.audit(tx, actor, 'device.restored', 'NetworkDevice', id, sourceIp);
      return tx.networkDevice.findFirstOrThrow({ where: { id, tenantId: actor.tenantId } });
    });
  }

  listEvents(actor: AuthenticatedUser) {
    return this.prisma.securityEvent.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  createEvent(actor: AuthenticatedUser, input: CreateEventDto, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.securityEvent.create({
        data: {
          tenantId: actor.tenantId,
          title: input.title.trim(),
          description: input.description.trim(),
          source: input.source.trim(),
          severity: input.severity,
          status: input.status ?? 'open',
          ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
        },
      });
      await this.audit(tx, actor, 'security_event.created', 'SecurityEvent', event.id, sourceIp);
      return event;
    });
  }

  updateEvent(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateEventDto,
    sourceIp?: string,
  ) {
    const data: Prisma.SecurityEventUpdateManyMutationInput = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.source !== undefined) data.source = input.source.trim();
    if (input.severity !== undefined) data.severity = input.severity;
    if (input.status !== undefined) data.status = input.status;
    this.requireChanges(data);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.securityEvent.updateMany({
        where: { id, tenantId: actor.tenantId },
        data,
      });
      if (!updated.count) throw new NotFoundException('Security event not found.');
      const event = await tx.securityEvent.findFirstOrThrow({
        where: { id, tenantId: actor.tenantId },
      });
      await this.audit(tx, actor, 'security_event.updated', 'SecurityEvent', id, sourceIp);
      return event;
    });
  }

  listPolicies(actor: AuthenticatedUser) {
    return this.prisma.securityPolicy.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createPolicy(actor: AuthenticatedUser, input: CreatePolicyDto, sourceIp?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const policy = await tx.securityPolicy.create({
          data: {
            tenantId: actor.tenantId,
            name: input.name.trim(),
            summary: input.summary.trim(),
            status: input.status ?? 'draft',
          },
        });
        await this.audit(tx, actor, 'policy.created', 'SecurityPolicy', policy.id, sourceIp);
        return policy;
      });
    } catch (error) {
      this.throwOnDuplicate(error, 'A policy with this name already exists.');
      throw error;
    }
  }

  async updatePolicy(
    actor: AuthenticatedUser,
    id: string,
    input: UpdatePolicyDto,
    sourceIp?: string,
  ) {
    const data: Prisma.SecurityPolicyUpdateManyMutationInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.summary !== undefined) data.summary = input.summary.trim();
    if (input.status !== undefined) data.status = input.status;
    this.requireChanges(data);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.securityPolicy.updateMany({
          where: { id, tenantId: actor.tenantId },
          data,
        });
        if (!updated.count) throw new NotFoundException('Policy not found.');
        const policy = await tx.securityPolicy.findFirstOrThrow({
          where: { id, tenantId: actor.tenantId },
        });
        await this.audit(tx, actor, 'policy.updated', 'SecurityPolicy', id, sourceIp);
        return policy;
      });
    } catch (error) {
      this.throwOnDuplicate(error, 'A policy with this name already exists.');
      throw error;
    }
  }

  listIncidents(actor: AuthenticatedUser) {
    return this.prisma.incident.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { openedAt: 'desc' },
    });
  }

  createIncident(actor: AuthenticatedUser, input: CreateIncidentDto, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          tenantId: actor.tenantId,
          title: input.title.trim(),
          summary: input.summary.trim(),
          severity: input.severity,
          status: input.status ?? 'open',
        },
      });
      await this.audit(tx, actor, 'incident.created', 'Incident', incident.id, sourceIp);
      return incident;
    });
  }

  updateIncident(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateIncidentDto,
    sourceIp?: string,
  ) {
    const data: Prisma.IncidentUpdateManyMutationInput = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.summary !== undefined) data.summary = input.summary.trim();
    if (input.severity !== undefined) data.severity = input.severity;
    if (input.status !== undefined) data.status = input.status;
    this.requireChanges(data);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.updateMany({
        where: { id, tenantId: actor.tenantId },
        data,
      });
      if (!updated.count) throw new NotFoundException('Incident not found.');
      const incident = await tx.incident.findFirstOrThrow({
        where: { id, tenantId: actor.tenantId },
      });
      await this.audit(tx, actor, 'incident.updated', 'Incident', id, sourceIp);
      if (incident.reporterUserId) {
        await tx.staffNotification.create({
          data: {
            tenantId: actor.tenantId,
            userId: incident.reporterUserId,
            category: 'incident_update',
            title: `Your security report was ${incident.status.replaceAll('_', ' ')}`,
            body: `An administrator updated “${incident.title}”. Status: ${incident.status.replaceAll('_', ' ')}.`,
          },
        });
      }
      return incident;
    });
  }

  private requireChanges(data: object): void {
    if (!Object.keys(data).length) {
      throw new BadRequestException('Provide at least one field to update.');
    }
  }

  private throwOnDuplicate(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    action: string,
    targetType: string,
    targetId: string,
    sourceIp?: string,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        action,
        targetType,
        targetId,
        sourceIp,
      },
    });
  }
}
