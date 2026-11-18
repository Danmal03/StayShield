import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { CreateNetworkIntegrationDto, NetworkProviderEventDto } from './network-monitoring.dto';

const adminRoles = ['SYSTEM_OWNER', 'SECURITY_ADMINISTRATOR', 'NETWORK_ADMINISTRATOR'];

@Injectable()
export class NetworkMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async current(actor: AuthenticatedUser) {
    const now = new Date();
    const cutoff = this.freshnessCutoff(now);
    const active = await this.prisma.networkConnectionSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        employeeId: actor.id,
        verificationStatus: 'verified',
        status: 'connected',
        lastSeenAt: { gte: cutoff },
        integration: { isEnabled: true },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (active) {
      return { status: 'connected', connection: this.publicConnection(active), updatedAt: active.lastSeenAt };
    }

    const lastKnown = await this.prisma.networkConnectionSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        employeeId: actor.id,
        verificationStatus: 'verified',
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        status: true,
        lastSeenAt: true,
        integration: { select: { isEnabled: true } },
      },
    });
    if (lastKnown?.status === 'connected') {
      return { status: 'unverified', connection: null, updatedAt: lastKnown.lastSeenAt };
    }
    if (
      lastKnown?.status === 'disconnected' &&
      lastKnown.lastSeenAt >= cutoff &&
      lastKnown.integration?.isEnabled
    ) {
      return { status: 'disconnected', connection: null, updatedAt: lastKnown.lastSeenAt };
    }

    const integrationStatus = await this.status(actor);
    return {
      status: integrationStatus.status === 'not_configured' ? 'not_configured' : 'unverified',
      connection: null,
      updatedAt: integrationStatus.lastEventAt,
    };
  }

  async history(actor: AuthenticatedUser) {
    const now = new Date();
    const cutoff = this.freshnessCutoff(now);
    const sessions = await this.prisma.networkConnectionSession.findMany({
      where: {
        tenantId: actor.tenantId,
        employeeId: actor.id,
        verificationStatus: 'verified',
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });
    return sessions.map((session) => ({
      ...this.publicConnection(session),
      status: session.status === 'connected' && session.lastSeenAt < cutoff
        ? 'unverified'
        : session.status,
    }));
  }

  async status(actor: AuthenticatedUser) {
    const integrations = await this.prisma.networkIntegration.findMany({
      where: { tenantId: actor.tenantId },
      select: { source: true, isEnabled: true, lastEventAt: true },
    });
    const enabled = integrations.filter((integration) => integration.isEnabled);
    const lastEventAt = enabled
      .map((integration) => integration.lastEventAt)
      .filter((date): date is Date => date !== null)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const isFresh = enabled.some((integration) =>
      integration.lastEventAt !== null && integration.lastEventAt >= this.freshnessCutoff(new Date()),
    );
    return {
      status: integrations.length === 0
        ? 'not_configured'
        : enabled.length > 0 && isFresh
          ? 'available'
          : 'unverified',
      configured: enabled.length > 0,
      sources: [...new Set(enabled.map((integration) => integration.source))],
      lastEventAt,
      freshnessSeconds: this.freshnessSeconds(),
    };
  }

  async adminSessions(actor: AuthenticatedUser) {
    this.requireAdmin(actor);
    const cutoff = this.freshnessCutoff(new Date());
    const sessions = await this.prisma.networkConnectionSession.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        employee: { select: { displayName: true, email: true } },
        device: { select: { name: true, deviceType: true } },
        integration: { select: { isEnabled: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
    return sessions.map((session) => ({
      ...this.publicConnection(session),
      status: session.status === 'connected' && (
        session.lastSeenAt < cutoff || !session.integration?.isEnabled
      )
        ? 'unverified'
        : session.status,
      employee: session.employee,
      device: session.device,
    }));
  }

  async adminIntegrations(actor: AuthenticatedUser) {
    this.requireAdmin(actor);
    const integrations = await this.prisma.networkIntegration.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        id: true,
        name: true,
        source: true,
        isEnabled: true,
        lastEventAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const cutoff = this.freshnessCutoff(new Date());
    return integrations.map((integration) => ({
      ...integration,
      status: !integration.isEnabled
        ? 'disabled'
        : integration.lastEventAt && integration.lastEventAt >= cutoff
          ? 'available'
          : 'unverified',
    }));
  }

  async createIntegration(actor: AuthenticatedUser, input: CreateNetworkIntegrationDto, sourceIp?: string) {
    this.requireAdmin(actor);
    if (input.source === 'simulation' && process.env.NODE_ENV !== 'development') {
      throw new BadRequestException('Simulation integrations are available only in development.');
    }
    const name = input.name.trim();
    if (name.length < 2) throw new BadRequestException('Integration name must contain at least two characters.');
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const integration = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.networkIntegration.create({
        data: {
          tenantId: actor.tenantId,
          name,
          source: input.source,
          tokenHash,
          createdById: actor.id,
        },
        select: { id: true, name: true, source: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.id,
          action: 'network.integration_created',
          targetType: 'NetworkIntegration',
          targetId: created.id,
          sourceIp,
          metadata: { source: created.source },
        },
      });
      return created;
    });
    return { ...integration, token };
  }

  async disableIntegration(actor: AuthenticatedUser, id: string, sourceIp?: string) {
    this.requireAdmin(actor);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.networkIntegration.updateMany({
        where: { id, tenantId: actor.tenantId, isEnabled: true },
        data: { isEnabled: false },
      });
      if (!result.count) return false;
      await transaction.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.id,
          action: 'network.integration_disabled',
          targetType: 'NetworkIntegration',
          targetId: id,
          sourceIp,
        },
      });
      return true;
    });
    if (!updated) throw new NotFoundException('Network integration not found.');
    return { success: true };
  }

  async ingest(token: string | undefined, input: NetworkProviderEventDto) {
    if (!token) throw new UnauthorizedException('Network integration credentials are required.');
    const integration = await this.prisma.networkIntegration.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!integration?.isEnabled) throw new UnauthorizedException('Network integration credentials are invalid.');
    if (integration.source === 'simulation' && process.env.NODE_ENV !== 'development') {
      throw new UnauthorizedException('Simulation integration credentials are disabled outside development.');
    }

    const sourceSessionId = input.sourceSessionId.trim();
    if (!sourceSessionId) throw new BadRequestException('Provider session identifier cannot be empty.');
    const receivedAt = new Date();
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : receivedAt;
    if (occurredAt.getTime() > receivedAt.getTime() + 5 * 60_000) {
      throw new BadRequestException('Network event timestamp is too far in the future.');
    }
    const eventAt = occurredAt > receivedAt ? receivedAt : occurredAt;

    const latestSession = await this.prisma.networkConnectionSession.findFirst({
      where: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        sourceSessionId,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (latestSession && eventAt <= latestSession.lastSeenAt) {
      return { accepted: false, reason: 'stale_event' };
    }
    const current = latestSession?.status === 'connected' ? latestSession : null;

    const identity = await this.resolveIdentity(integration.tenantId, input, current);
    const connectionType = input.connectionType;
    const sameType = current?.connectionType === connectionType;
    const details = {
      connectionType,
      ssid: connectionType === 'wifi'
        ? clean(input.ssid) ?? (sameType ? current?.ssid ?? null : null)
        : null,
      carrierName: connectionType === 'cellular'
        ? clean(input.carrierName) ?? (sameType ? current?.carrierName ?? null : null)
        : null,
      ipAddress: clean(input.ipAddress) ?? (sameType ? current?.ipAddress ?? null : null),
      networkSegment: clean(input.networkSegment) ?? (sameType ? current?.networkSegment ?? null : null),
      accessPoint: clean(input.accessPoint) ?? (sameType ? current?.accessPoint ?? null : null),
      securityStatus: input.securityStatus ?? (sameType ? current?.securityStatus ?? 'not_available' : 'not_available'),
    };

    let session;
    if (input.eventType === 'disconnected') {
      if (current) {
        const identityChanged = current.employeeId !== identity.employeeId ||
          current.deviceId !== identity.deviceId ||
          current.verificationStatus !== identity.verificationStatus;
        session = await this.prisma.networkConnectionSession.update({
          where: { id: current.id },
          data: {
            ...(identityChanged
              ? { employeeId: null, deviceId: null, verificationStatus: 'unverified' }
              : {}),
            status: 'disconnected',
            disconnectedAt: eventAt,
            lastSeenAt: eventAt,
          },
        });
      } else {
        session = await this.prisma.networkConnectionSession.create({
          data: {
            tenantId: integration.tenantId,
            integrationId: integration.id,
            source: integration.source,
            sourceSessionId,
            ...details,
            ...identity,
            status: 'disconnected',
            connectedAt: null,
            disconnectedAt: eventAt,
            lastSeenAt: eventAt,
          },
        });
      }
    } else {
      const detailsChanged = current && (
        current.connectionType !== details.connectionType ||
        current.ssid !== details.ssid ||
        current.carrierName !== details.carrierName ||
        current.ipAddress !== details.ipAddress ||
        current.networkSegment !== details.networkSegment ||
        current.accessPoint !== details.accessPoint ||
        current.securityStatus !== details.securityStatus ||
        current.employeeId !== identity.employeeId ||
        current.deviceId !== identity.deviceId ||
        current.verificationStatus !== identity.verificationStatus
      );
      if (current && detailsChanged) {
        await this.prisma.networkConnectionSession.update({
          where: { id: current.id },
          data: { status: 'disconnected', disconnectedAt: eventAt, lastSeenAt: eventAt },
        });
      }
      if (current && !detailsChanged) {
        session = await this.prisma.networkConnectionSession.update({
          where: { id: current.id },
          data: { ...details, ...identity, lastSeenAt: eventAt },
        });
      } else {
        if (identity.deviceId) {
          await this.prisma.networkConnectionSession.updateMany({
            where: {
              tenantId: integration.tenantId,
              integrationId: integration.id,
              deviceId: identity.deviceId,
              status: 'connected',
              ...(current ? { id: { not: current.id } } : {}),
            },
            data: { status: 'disconnected', disconnectedAt: eventAt, lastSeenAt: eventAt },
          });
        }
        session = await this.prisma.networkConnectionSession.create({
          data: {
            tenantId: integration.tenantId,
            integrationId: integration.id,
            source: integration.source,
            sourceSessionId,
            ...details,
            ...identity,
            status: 'connected',
            connectedAt: input.eventType === 'connected' || current ? eventAt : null,
            disconnectedAt: null,
            lastSeenAt: eventAt,
          },
        });
      }
    }

    await this.prisma.networkIntegration.update({
      where: { id: integration.id },
      data: { lastEventAt: eventAt },
    });
    return { accepted: true, verificationStatus: session.verificationStatus };
  }

  private async resolveIdentity(
    tenantId: string,
    input: NetworkProviderEventDto,
    current: { employeeId: string | null; deviceId: string | null; verificationStatus: string } | null,
  ) {
    if (!input.employeeEmail && !input.registeredDeviceId && current) {
      return {
        employeeId: current.employeeId,
        deviceId: current.deviceId,
        verificationStatus: current.verificationStatus,
      };
    }

    const [employee, device] = await Promise.all([
      input.employeeEmail
        ? this.prisma.user.findFirst({
            where: {
              tenantId,
              email: { equals: input.employeeEmail.trim(), mode: 'insensitive' },
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.registeredDeviceId
        ? this.prisma.personalDevice.findFirst({
            where: {
              id: input.registeredDeviceId,
              tenantId,
              status: 'approved',
              user: { isActive: true },
            },
            select: { id: true, userId: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.employeeEmail && input.registeredDeviceId) {
      if (employee && device && employee.id === device.userId) {
        return { employeeId: employee.id, deviceId: device.id, verificationStatus: 'verified' };
      }
      return { employeeId: null, deviceId: null, verificationStatus: 'unverified' };
    }
    if (employee && input.employeeEmail) {
      return {
        employeeId: employee.id,
        deviceId: current?.employeeId === employee.id ? current.deviceId : null,
        verificationStatus: 'verified',
      };
    }
    if (device && input.registeredDeviceId) {
      return { employeeId: device.userId, deviceId: device.id, verificationStatus: 'verified' };
    }
    return { employeeId: null, deviceId: null, verificationStatus: 'unverified' };
  }

  private publicConnection(session: {
    id: string;
    source: string;
    connectionType: string;
    ssid: string | null;
    carrierName: string | null;
    ipAddress: string | null;
    networkSegment: string | null;
    accessPoint: string | null;
    securityStatus: string;
    status: string;
    verificationStatus: string;
    connectedAt: Date | null;
    disconnectedAt: Date | null;
    lastSeenAt: Date;
  }) {
    return {
      id: session.id,
      source: session.source,
      connectionType: session.connectionType,
      ssid: session.ssid,
      carrierName: session.carrierName,
      ipAddress: session.ipAddress,
      networkSegment: session.networkSegment,
      accessPoint: session.accessPoint,
      securityStatus: session.securityStatus,
      status: session.status,
      verificationStatus: session.verificationStatus,
      connectedAt: session.connectedAt,
      disconnectedAt: session.disconnectedAt,
      lastSeenAt: session.lastSeenAt,
    };
  }

  private requireAdmin(actor: AuthenticatedUser) {
    if (!actor.roles.some((role) => adminRoles.includes(role))) {
      throw new NotFoundException('Network administration is unavailable.');
    }
  }

  private freshnessSeconds() {
    const configured = Number(process.env.NETWORK_SESSION_FRESHNESS_SECONDS ?? 300);
    return Number.isInteger(configured) && configured >= 30 && configured <= 3600 ? configured : 300;
  }

  private freshnessCutoff(now: Date) {
    return new Date(now.getTime() - this.freshnessSeconds() * 1000);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
