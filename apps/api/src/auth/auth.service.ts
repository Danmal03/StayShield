import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './auth.dto';
import { rolesForTenant } from './auth.types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c3RheXNoaWVsZC1kdW1teS1zYWx0$SZag54eUGqefJ4ne6XjW5zELbN7up/awOKlwlo1iz3A';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(
    input: LoginDto,
    sourceIp: string | undefined,
  ): Promise<{ token: string; expiresAt: Date; user: object }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roleAssignments: { select: { role: true, tenantId: true } } },
    });

    const now = new Date();
    const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > now);
    const passwordMatches = user
      ? await argon2.verify(user.passwordHash, input.password)
      : await argon2.verify(DUMMY_PASSWORD_HASH, input.password);
    if (
      !user ||
      !user.isActive ||
      isLocked ||
      !passwordMatches
    ) {
      if (user?.isActive && !isLocked) {
        const attempts = user.failedLoginAttempts + 1;
        const lockedUntil =
          attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
            : null;
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: lockedUntil ? 0 : attempts,
              lockedUntil,
            },
          }),
          this.prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              actorId: user.id,
              action: 'auth.login_failed',
              sourceIp,
            },
          }),
        ]);
      } else {
        await this.prisma.auditLog.create({
          data: { action: 'auth.login_failed', sourceIp },
        });
      }
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 8);
    if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > 24) {
      throw new Error('SESSION_TTL_HOURS must be an integer from 1 to 24.');
    }
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60_000);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.id,
          action: 'auth.login_succeeded',
          sourceIp,
        },
      }),
    ]);

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        displayName: user.displayName,
        roles: rolesForTenant(user.roleAssignments, user.tenantId),
      },
    };
  }

  async logout(
    token: string | undefined,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    if (token) {
      await this.prisma.session.deleteMany({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      });
    }
    await this.prisma.auditLog.create({
      data: { tenantId, actorId: userId, action: 'auth.logout' },
    });
  }
}
