import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ActivityAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.method !== 'GET' || !request.auth) {
      return next.handle();
    }

    const routePath = request.route?.path;
    const target = `${request.baseUrl}${routePath ?? request.path}`;
    return next.handle().pipe(
      concatMap((response: unknown) =>
        from(
          this.prisma.auditLog.create({
            data: {
              tenantId: request.auth.tenantId,
              actorId: request.auth.id,
              action: 'system.viewed',
              targetType: 'API route',
              targetId: target,
              sourceIp: request.ip,
              metadata: { method: request.method },
            },
          }),
        ).pipe(map(() => response)),
      ),
    );
  }
}
