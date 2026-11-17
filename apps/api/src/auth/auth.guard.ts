import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { IS_PUBLIC, SESSION_COOKIE } from './auth.constants';
import { PrismaService } from '../prisma.service';
import { AuthenticatedRequest, rolesForTenant } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 32) {
      throw new UnauthorizedException('Authentication required.');
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      include: {
        user: {
          include: { roleAssignments: { select: { role: true, tenantId: true } } },
        },
      },
    });

    if (
      !session ||
      session.expiresAt <= new Date() ||
      !session.user.isActive ||
      rolesForTenant(session.user.roleAssignments, session.user.tenantId).length === 0
    ) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Session expired or invalid.');
    }

    request.auth = {
      id: session.user.id,
      sessionId: session.id,
      tenantId: session.user.tenantId,
      email: session.user.email,
      displayName: session.user.displayName,
      roles: rolesForTenant(session.user.roleAssignments, session.user.tenantId),
    };
    return true;
  }
}
