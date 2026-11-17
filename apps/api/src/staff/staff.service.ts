import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { isAdmin } from '../auth/access';
import { CreateStaffDto } from './staff.dto';

const publicStaff = {
  id: true,
  email: true,
  displayName: true,
  isActive: true,
  createdAt: true,
  roleAssignments: { select: { role: true, tenantId: true } },
  staffProfile: { select: { department: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      select: publicStaff,
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.present(user, actor.tenantId));
  }

  async create(actor: AuthenticatedUser, input: CreateStaffDto, sourceIp?: string) {
    if (!isAdmin(actor.roles)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    if (input.role === SystemRole.SYSTEM_OWNER && !actor.roles.includes(SystemRole.SYSTEM_OWNER)) {
      throw new ForbiddenException('Only the system owner can assign the system owner role.');
    }

    const email = input.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      if (input.departmentId) {
        const department = await this.prisma.department.findFirst({
          where: { id: input.departmentId, tenantId: actor.tenantId, isActive: true },
          select: { id: true },
        });
        if (!department) {
          throw new ConflictException('Choose an active department in this hotel group.');
        }
      }
      const user = await this.prisma.user.create({
        data: {
          tenantId: actor.tenantId,
          email,
          displayName: input.displayName.trim(),
          passwordHash,
          emailVerifiedAt: new Date(),
          roleAssignments: {
            create: { tenantId: actor.tenantId, role: input.role },
          },
          staffProfile: {
            create: {
              tenantId: actor.tenantId,
              ...(input.departmentId ? { departmentId: input.departmentId } : {}),
            },
          },
        },
        select: publicStaff,
      });
      await this.prisma.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.id,
          action: 'staff.created',
          targetType: 'User',
          targetId: user.id,
          sourceIp,
          metadata: { email: user.email, role: input.role },
        },
      });
      return this.present(user, actor.tenantId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  private present(
    user: {
      id: string;
      email: string;
      displayName: string;
      isActive: boolean;
      createdAt: Date;
      roleAssignments: { role: SystemRole; tenantId: string }[];
      staffProfile: { department: { id: string; name: string } | null } | null;
    },
    tenantId: string,
  ) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.roleAssignments
        .filter((assignment) => assignment.tenantId === tenantId)
        .map((assignment) => assignment.role),
      department: user.staffProfile?.department ?? null,
    };
  }
}
