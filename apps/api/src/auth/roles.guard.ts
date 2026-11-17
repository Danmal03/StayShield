import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLES } from './auth.constants';
import { AuthenticatedRequest } from './auth.types';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth?.roles.some((role) => required.includes(role))) {
      const routePath = request.route?.path;
      await this.prisma.auditLog.create({
        data: {
          tenantId: request.auth?.tenantId,
          actorId: request.auth?.id,
          action: 'permission.denied',
          targetType: 'API route',
          targetId: `${request.baseUrl}${routePath ?? request.path}`,
          sourceIp: request.ip,
          metadata: { requiredRoles: required },
        },
      });
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
