import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityAuditInterceptor } from './audit/activity-audit.interceptor';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { HealthModule } from './health/health.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma.module';
import { StaffModule } from './staff/staff.module';
import { StaffPortalModule } from './staff-portal/staff-portal.module';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    OperationsModule,
    PrismaModule,
    StaffModule,
    StaffPortalModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  providers: [
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ActivityAuditInterceptor },
  ],
})
export class AppModule {}
