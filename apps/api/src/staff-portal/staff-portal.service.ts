import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import {
  AssignTrainingDto,
  ChangePasswordDto,
  CreateAnnouncementDto,
  CreatePersonalDeviceDto,
  CreateSecurityReportDto,
  CreateStaffRequestDto,
  CreateTrainingCourseDto,
  DepartmentDto,
  SubmitTrainingDto,
  UpdateStaffProfileDto,
  UpdateStaffRequestDto,
} from './staff-portal.dto';

const permissionForCategory: Record<string, string> = {
  website_access: 'websiteAccessRequest',
  device_registration: 'deviceRegistration',
  network_connectivity: 'networkSupport',
  account_assistance: 'accountAssistance',
  lost_device: 'lostDeviceReport',
  security_incident: 'securityReport',
  suspicious_email: 'securityReport',
  suspected_malware: 'securityReport',
  suspicious_device: 'securityReport',
  general_it_support: 'supportRequest',
};

@Injectable()
export class StaffPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: actor.id, tenantId: actor.tenantId },
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
        staffProfile: { include: { department: true } },
      },
    });
    const canAccessTraining = !user.staffProfile?.department ||
      (user.staffProfile.department.isActive &&
        user.staffProfile.department.permissions.includes('training'));
    const [devices, requests, assignments, notifications, announcements, score, logins, reports] =
      await Promise.all([
        this.prisma.personalDevice.findMany({
          where: { tenantId: actor.tenantId, userId: actor.id },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.staffRequest.findMany({
          where: { tenantId: actor.tenantId, userId: actor.id },
          include: { assignedAdmin: { select: { displayName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.trainingAssignment.findMany({
          where: { tenantId: actor.tenantId, userId: actor.id },
          include: { course: true, completion: true },
          orderBy: { dueAt: 'asc' },
        }),
        this.prisma.staffNotification.findMany({
          where: { tenantId: actor.tenantId, userId: actor.id },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        this.prisma.securityAnnouncement.findMany({
          where: {
            tenantId: actor.tenantId,
            isActive: true,
            OR: userDepartmentId(user)
              ? [{ audienceDepartmentId: null }, { audienceDepartmentId: userDepartmentId(user) }]
              : [{ audienceDepartmentId: null }],
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.employeeSecurityScore.findFirst({
          where: { tenantId: actor.tenantId, userId: actor.id },
          orderBy: { calculatedAt: 'desc' },
        }),
        this.prisma.auditLog.findMany({
          where: {
            tenantId: actor.tenantId,
            actorId: actor.id,
            action: { in: ['auth.login_succeeded', 'auth.login_failed', 'auth.logout'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, action: true, sourceIp: true, createdAt: true },
        }),
        this.prisma.incident.findMany({
          where: { tenantId: actor.tenantId, reporterUserId: actor.id },
          orderBy: { openedAt: 'desc' },
          take: 10,
          select: { id: true, title: true, status: true, severity: true, openedAt: true },
        }),
      ]);

    const activeSessions = await this.prisma.session.count({
      where: { userId: actor.id, expiresAt: { gt: new Date() } },
    });
    const recentActivity = [
      ...logins.map((entry) => ({
        id: entry.id,
        title: entry.action.replace('auth.', '').replaceAll('_', ' '),
        category: 'account',
        status: entry.action === 'auth.login_failed' ? 'attention' : 'recorded',
        occurredAt: entry.createdAt,
      })),
      ...reports.map((report) => ({
        id: report.id,
        title: report.title,
        category: 'report',
        status: report.status,
        occurredAt: report.openedAt,
      })),
    ]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 10);

    return {
      profile: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        createdAt: user.createdAt,
        jobTitle: user.staffProfile?.jobTitle ?? null,
        department: user.staffProfile?.department
          ? {
              id: user.staffProfile.department.id,
              name: user.staffProfile.department.name,
              permissions: user.staffProfile.department.permissions,
              isActive: user.staffProfile.department.isActive,
            }
          : null,
        notificationPreferences: user.staffProfile?.notificationPreferences ?? {},
      },
      summary: {
        registeredDevices: devices.filter((device) => device.status === 'approved').length,
        pendingRequests: requests.filter((request) => ['pending', 'in_progress'].includes(request.status)).length,
        unreadNotifications: notifications.filter((notification) => !notification.readAt).length,
        assignedTraining: canAccessTraining
          ? assignments.filter((assignment) => !assignment.completion?.passed).length
          : 0,
        activeSessions,
      },
      devices,
      requests,
      trainingAssignments: canAccessTraining ? assignments.map((assignment) => ({
        id: assignment.id,
        dueAt: assignment.dueAt,
        createdAt: assignment.createdAt,
        completion: assignment.completion,
        course: this.publicCourse(assignment.course),
      })) : [],
      notifications,
      announcements,
      securityScore: score
        ? { score: score.score, breakdown: score.breakdown, calculatedAt: score.calculatedAt }
        : null,
      webAccess: {
        providerConnected: false,
        policyStatus: 'not_connected',
        message: 'Website permissions and filtering are not connected to a network provider.',
      },
      recentActivity,
    };
  }

  async updateProfile(actor: AuthenticatedUser, input: UpdateStaffProfileDto, sourceIp?: string) {
    if (!input.displayName && input.jobTitle === undefined && !input.notificationPreferences) {
      throw new BadRequestException('Provide at least one profile field to update.');
    }

    let preferences: Prisma.InputJsonValue | undefined;
    if (input.notificationPreferences) {
      const entries = Object.entries(input.notificationPreferences);
      const validatedPreferences: Record<string, boolean> = {};
      for (const [key, value] of entries) {
        if (!['email', 'inApp'].includes(key) || typeof value !== 'boolean') {
          throw new BadRequestException('Notification preferences may only contain email and inApp boolean values.');
        }
        validatedPreferences[key] = value;
      }
      preferences = validatedPreferences;
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.displayName) {
        await tx.user.updateMany({
          where: { id: actor.id, tenantId: actor.tenantId },
          data: { displayName: input.displayName.trim() },
        });
      }
      const profile = await tx.staffSecurityProfile.upsert({
        where: { userId: actor.id },
        create: {
          tenantId: actor.tenantId,
          userId: actor.id,
          jobTitle: input.jobTitle?.trim() || null,
          ...(preferences !== undefined ? { notificationPreferences: preferences } : {}),
        },
        update: {
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() || null } : {}),
          ...(preferences !== undefined ? { notificationPreferences: preferences } : {}),
        },
        include: { department: true, user: { select: { displayName: true, email: true } } },
      });
      await this.audit(tx, actor, 'staff_profile.updated', 'StaffSecurityProfile', profile.id, sourceIp);
      return {
        displayName: profile.user.displayName,
        email: profile.user.email,
        jobTitle: profile.jobTitle,
        department: profile.department?.name ?? null,
        notificationPreferences: profile.notificationPreferences ?? {},
      };
    });
  }

  async listDevices(actor: AuthenticatedUser) {
    return this.prisma.personalDevice.findMany({
      where: { tenantId: actor.tenantId, userId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDevice(actor: AuthenticatedUser, input: CreatePersonalDeviceDto, sourceIp?: string) {
    await this.requireDepartmentPermission(actor, 'deviceRegistration');
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.personalDevice.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.id,
          name: input.name.trim(),
          deviceType: input.deviceType.trim(),
          operatingSystem: input.operatingSystem.trim(),
        },
      });
      await this.audit(tx, actor, 'personal_device.requested', 'PersonalDevice', device.id, sourceIp);
      return device;
    });
  }

  async createRequest(actor: AuthenticatedUser, input: CreateStaffRequestDto, sourceIp?: string) {
    await this.requireDepartmentPermission(actor, permissionForCategory[input.category]);
    if (input.category === 'website_access' && !input.website) {
      throw new BadRequestException('Enter the website for an access request.');
    }
    if (input.temporaryUntil && new Date(input.temporaryUntil) <= new Date()) {
      throw new BadRequestException('Temporary access expiry must be in the future.');
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.staffRequest.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.id,
          category: input.category,
          description: input.description.trim(),
          website: input.website?.trim() || null,
          websiteCategory: input.websiteCategory?.trim() || null,
          temporaryUntil: input.temporaryUntil ? new Date(input.temporaryUntil) : null,
        },
      });
      await this.audit(tx, actor, 'staff_request.created', 'StaffRequest', request.id, sourceIp);
      return request;
    });
  }

  async createSecurityReport(actor: AuthenticatedUser, input: CreateSecurityReportDto, sourceIp?: string) {
    await this.requireDepartmentPermission(actor, 'securityReport');
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          tenantId: actor.tenantId,
          reporterUserId: actor.id,
          reportCategory: input.category,
          title: input.title.trim(),
          summary: input.description.trim(),
          severity: input.category === 'security_incident' || input.category === 'suspected_malware'
            ? 'medium'
            : 'low',
          status: 'open',
        },
      });
      await this.audit(tx, actor, 'employee_security_report.created', 'Incident', incident.id, sourceIp);
      return incident;
    });
  }

  async listOwnReports(actor: AuthenticatedUser) {
    return this.prisma.incident.findMany({
      where: { tenantId: actor.tenantId, reporterUserId: actor.id },
      orderBy: { openedAt: 'desc' },
    });
  }

  listOwnRequests(actor: AuthenticatedUser) {
    return this.prisma.staffRequest.findMany({
      where: { tenantId: actor.tenantId, userId: actor.id },
      include: { assignedAdmin: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAnnouncements(actor: AuthenticatedUser) {
    const profile = await this.prisma.staffSecurityProfile.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.id },
      select: { departmentId: true },
    });
    return this.prisma.securityAnnouncement.findMany({
      where: {
        tenantId: actor.tenantId,
        isActive: true,
        OR: [{ audienceDepartmentId: null }, ...(profile?.departmentId ? [{ audienceDepartmentId: profile.departmentId }] : [])],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listTraining(actor: AuthenticatedUser) {
    await this.requireDepartmentPermission(actor, 'training');
    const assignments = await this.prisma.trainingAssignment.findMany({
      where: { tenantId: actor.tenantId, userId: actor.id },
      include: { course: true, completion: true },
      orderBy: { dueAt: 'asc' },
    });
    return assignments.map((assignment) => ({
      id: assignment.id,
      dueAt: assignment.dueAt,
      createdAt: assignment.createdAt,
      completion: assignment.completion,
      course: this.publicCourse(assignment.course),
    }));
  }

  async submitTraining(actor: AuthenticatedUser, assignmentId: string, input: SubmitTrainingDto, sourceIp?: string) {
    await this.requireDepartmentPermission(actor, 'training');
    const assignment = await this.prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, tenantId: actor.tenantId, userId: actor.id },
      include: { course: true },
    });
    if (!assignment) throw new NotFoundException('Training assignment not found.');

    const questions = this.trainingQuestions(assignment.course.questions);
    if (input.answers.length !== questions.length ||
      input.answers.some((answer, index) => !Number.isInteger(answer) || answer >= questions[index].options.length)) {
      throw new BadRequestException('Answer every question using one of the listed options.');
    }
    const correct = input.answers.reduce(
      (count, answer, index) => count + (answer === questions[index].answerIndex ? 1 : 0),
      0,
    );
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= assignment.course.passingScore;

    return this.prisma.$transaction(async (tx) => {
      const completion = await tx.trainingCompletion.upsert({
        where: { assignmentId: assignment.id },
        create: { assignmentId: assignment.id, userId: actor.id, score, passed },
        update: { userId: actor.id, score, passed, completedAt: new Date() },
      });
      await this.audit(tx, actor, 'training.completed', 'TrainingCompletion', completion.id, sourceIp);
      return { score, passed, passingScore: assignment.course.passingScore, completedAt: completion.completedAt };
    });
  }

  listNotifications(actor: AuthenticatedUser) {
    return this.prisma.staffNotification.findMany({
      where: { tenantId: actor.tenantId, userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markNotificationRead(actor: AuthenticatedUser, id: string) {
    const updated = await this.prisma.staffNotification.updateMany({
      where: { id, tenantId: actor.tenantId, userId: actor.id },
      data: { readAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('Notification not found.');
    return { success: true };
  }

  async listSessions(actor: AuthenticatedUser) {
    return this.prisma.session.findMany({
      where: { userId: actor.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    }).then((sessions) => sessions.map((session) => ({
      ...session,
      current: session.id === actor.sessionId,
    })));
  }

  async revokeSession(actor: AuthenticatedUser, id: string) {
    if (id === actor.sessionId) throw new BadRequestException('Use Sign out to end the current session.');
    const deleted = await this.prisma.session.deleteMany({ where: { id, userId: actor.id } });
    if (!deleted.count) throw new NotFoundException('Session not found.');
    return { success: true };
  }

  async loginHistory(actor: AuthenticatedUser) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        action: { in: ['auth.login_succeeded', 'auth.login_failed', 'auth.logout'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, sourceIp: true, createdAt: true },
    });
  }

  async changePassword(actor: AuthenticatedUser, input: ChangePasswordDto, sourceIp?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, tenantId: actor.tenantId },
      select: { passwordHash: true },
    });
    if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException('Current password is incorrect.');
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException('Choose a new password different from the current password.');
    }
    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: actor.id, tenantId: actor.tenantId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      await tx.session.deleteMany({ where: { userId: actor.id, id: { not: actor.sessionId } } });
      await this.audit(tx, actor, 'auth.password_changed', 'User', actor.id, sourceIp);
    });
    return { success: true };
  }

  adminOverview(tenantId: string) {
    return Promise.all([
      this.prisma.staffRequest.findMany({
        where: { tenantId },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          assignedAdmin: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.personalDevice.findMany({
        where: { tenantId, status: 'pending' },
        include: { user: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.securityAnnouncement.findMany({
        where: { tenantId },
        include: { audienceDepartment: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.securityTrainingCourse.findMany({
        where: { tenantId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]).then(([requests, devices, departments, announcements, courses]) => ({
      requests,
      devices,
      departments,
      announcements,
      courses: courses.map(({ questions, ...course }) => ({
        ...course,
        questionCount: this.trainingQuestions(questions).length,
      })),
    }));
  }

  async updateRequest(actor: AuthenticatedUser, id: string, input: UpdateStaffRequestDto, sourceIp?: string) {
    const existing = await this.prisma.staffRequest.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Request not found.');
    const resolvedAt = ['approved', 'declined', 'resolved'].includes(input.status) ? new Date() : null;
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.staffRequest.update({
        where: { id },
        data: {
          status: input.status,
          adminResponse: input.adminResponse?.trim() || null,
          assignedAdminId: actor.id,
          resolvedAt,
        },
      });
      await tx.staffNotification.create({
        data: {
          tenantId: actor.tenantId,
          userId: existing.userId,
          requestId: request.id,
          category: 'request_update',
          title: `Your ${request.category.replaceAll('_', ' ')} request was updated`,
          body: input.adminResponse?.trim() || `Request status: ${input.status.replaceAll('_', ' ')}.`,
        },
      });
      await this.audit(tx, actor, 'staff_request.updated', 'StaffRequest', request.id, sourceIp);
      return request;
    });
  }

  async reviewDevice(actor: AuthenticatedUser, id: string, status: 'approved' | 'declined', sourceIp?: string) {
    const updated = await this.prisma.personalDevice.updateMany({
      where: { id, tenantId: actor.tenantId, status: 'pending' },
      data: {
        status,
        complianceStatus: status === 'approved' ? 'unknown' : 'not_approved',
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    if (!updated.count) throw new NotFoundException('Pending device request not found.');
    const device = await this.prisma.personalDevice.findFirstOrThrow({ where: { id, tenantId: actor.tenantId } });
    await this.prisma.$transaction([
      this.prisma.staffNotification.create({
        data: {
          tenantId: actor.tenantId,
          userId: device.userId,
          category: 'device_update',
          title: `Device request ${status}`,
          body: `Your request to register ${device.name} was ${status}.`,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.id,
          action: `personal_device.${status}`,
          targetType: 'PersonalDevice',
          targetId: id,
          sourceIp,
        },
      }),
    ]);
    return device;
  }

  async listDepartments(actor: AuthenticatedUser) {
    return this.prisma.department.findMany({ where: { tenantId: actor.tenantId }, orderBy: { name: 'asc' } });
  }

  async assignDepartment(actor: AuthenticatedUser, userId: string, departmentId: string | null, sourceIp?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: actor.tenantId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Active staff account not found.');
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId: actor.tenantId, isActive: true },
        select: { id: true },
      });
      if (!department) throw new NotFoundException('Active department not found.');
    }
    const profile = await this.prisma.staffSecurityProfile.upsert({
      where: { userId },
      create: { tenantId: actor.tenantId, userId, departmentId },
      update: { departmentId },
    });
    await this.writeAudit(actor, 'staff.department_assigned', 'User', userId, sourceIp);
    return profile;
  }

  async createDepartment(actor: AuthenticatedUser, input: DepartmentDto, sourceIp?: string) {
    try {
      const department = await this.prisma.department.create({
        data: {
          tenantId: actor.tenantId,
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
          permissions: input.permissions,
          isActive: input.isActive ?? true,
        },
      });
      await this.writeAudit(actor, 'department.created', 'Department', department.id, sourceIp);
      return department;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this name already exists.');
      }
      throw error;
    }
  }

  async updateDepartment(actor: AuthenticatedUser, id: string, input: DepartmentDto, sourceIp?: string) {
    try {
      const result = await this.prisma.department.updateMany({
        where: { id, tenantId: actor.tenantId },
        data: {
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
          permissions: input.permissions,
          isActive: input.isActive ?? true,
        },
      });
      if (!result.count) throw new NotFoundException('Department not found.');
      await this.writeAudit(actor, 'department.updated', 'Department', id, sourceIp);
      return this.prisma.department.findFirstOrThrow({ where: { id, tenantId: actor.tenantId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this name already exists.');
      }
      throw error;
    }
  }

  async deleteDepartment(actor: AuthenticatedUser, id: string, sourceIp?: string) {
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!department) throw new NotFoundException('Department not found.');

      await tx.securityAnnouncement.updateMany({
        where: { tenantId: actor.tenantId, audienceDepartmentId: id },
        data: { isActive: false },
      });
      const deleted = await tx.department.deleteMany({
        where: { id, tenantId: actor.tenantId },
      });
      if (!deleted.count) throw new NotFoundException('Department not found.');
      await this.audit(tx, actor, 'department.deleted', 'Department', id, sourceIp);
      return { id };
    });
  }

  async createAnnouncement(actor: AuthenticatedUser, input: CreateAnnouncementDto, sourceIp?: string) {
    const departmentId = input.audienceDepartmentId ?? null;
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId: actor.tenantId },
      });
      if (!department) throw new NotFoundException('Department not found.');
    }
    return this.prisma.$transaction(async (tx) => {
      const announcement = await tx.securityAnnouncement.create({
        data: {
          tenantId: actor.tenantId,
          title: input.title.trim(),
          body: input.body.trim(),
          audienceDepartmentId: departmentId,
          createdById: actor.id,
        },
      });
      const recipients = await tx.user.findMany({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          ...(departmentId ? { staffProfile: { departmentId } } : {}),
        },
        select: { id: true },
      });
      if (recipients.length) {
        await tx.staffNotification.createMany({
          data: recipients.map((recipient) => ({
            tenantId: actor.tenantId,
            userId: recipient.id,
            category: 'security_announcement',
            title: announcement.title,
            body: announcement.body,
          })),
        });
      }
      await this.audit(tx, actor, 'security_announcement.created', 'SecurityAnnouncement', announcement.id, sourceIp);
      return announcement;
    });
  }

  async createTrainingCourse(actor: AuthenticatedUser, input: CreateTrainingCourseDto, sourceIp?: string) {
    if (input.questions.some((question) => question.answerIndex >= question.options.length)) {
      throw new BadRequestException('Each correct answer must match one of the question options.');
    }
    const course = await this.prisma.securityTrainingCourse.create({
      data: {
        tenantId: actor.tenantId,
        title: input.title.trim(),
        summary: input.summary.trim(),
        content: input.content.trim(),
        questions: input.questions.map((question) => ({
          prompt: question.prompt,
          options: question.options,
          answerIndex: question.answerIndex,
        })),
        passingScore: input.passingScore ?? 80,
        isPublished: input.isPublished ?? false,
        createdById: actor.id,
      },
    });
    await this.writeAudit(actor, 'training_course.created', 'SecurityTrainingCourse', course.id, sourceIp);
    return { ...course, questions: this.publicQuestions(course.questions) };
  }

  async assignTraining(actor: AuthenticatedUser, courseId: string, input: AssignTrainingDto, sourceIp?: string) {
    const [course, user] = await Promise.all([
      this.prisma.securityTrainingCourse.findFirst({
        where: { id: courseId, tenantId: actor.tenantId, isPublished: true },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { id: input.userId, tenantId: actor.tenantId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!course) throw new NotFoundException('Published course not found.');
    if (!user) throw new NotFoundException('Active staff account not found.');
    try {
      const assignment = await this.prisma.trainingAssignment.create({
        data: {
          tenantId: actor.tenantId,
          courseId,
          userId: user.id,
          assignedById: actor.id,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        },
      });
      await this.prisma.staffNotification.create({
        data: {
          tenantId: actor.tenantId,
          userId: user.id,
          category: 'training_assignment',
          title: 'Security training assigned',
          body: 'A new security-awareness course has been assigned to your account.',
        },
      });
      await this.writeAudit(actor, 'training.assigned', 'TrainingAssignment', assignment.id, sourceIp);
      return assignment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This course is already assigned to this staff account.');
      }
      throw error;
    }
  }

  private async requireDepartmentPermission(actor: AuthenticatedUser, permission: string) {
    const profile = await this.prisma.staffSecurityProfile.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.id },
      include: { department: true },
    });
    if (profile?.department && (!profile.department.isActive || !profile.department.permissions.includes(permission))) {
      throw new ForbiddenException('This self-service action is not enabled for your department.');
    }
  }

  private trainingQuestions(value: Prisma.JsonValue): { prompt: string; options: string[]; answerIndex: number }[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') return [];
      const prompt = item.prompt;
      const options = item.options;
      const answerIndex = item.answerIndex;
      if (
        typeof prompt !== 'string' ||
        !Array.isArray(options) ||
        !options.every((option) => typeof option === 'string') ||
        typeof answerIndex !== 'number'
      ) return [];
      return [{ prompt, options, answerIndex }];
    });
  }

  private publicQuestions(value: Prisma.JsonValue) {
    return this.trainingQuestions(value).map(({ prompt, options }) => ({ prompt, options }));
  }

  private publicCourse(course: {
    id: string;
    title: string;
    summary: string;
    content: string;
    passingScore: number;
    questions: Prisma.JsonValue;
    isPublished: boolean;
  }) {
    return {
      id: course.id,
      title: course.title,
      summary: course.summary,
      content: course.content,
      passingScore: course.passingScore,
      questions: this.publicQuestions(course.questions),
      isPublished: course.isPublished,
    };
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
      data: { tenantId: actor.tenantId, actorId: actor.id, action, targetType, targetId, sourceIp },
    });
  }

  private writeAudit(
    actor: AuthenticatedUser,
    action: string,
    targetType: string,
    targetId: string,
    sourceIp?: string,
  ) {
    return this.prisma.auditLog.create({
      data: { tenantId: actor.tenantId, actorId: actor.id, action, targetType, targetId, sourceIp },
    });
  }
}

function userDepartmentId(user: { staffProfile: { departmentId: string | null } | null }): string | null {
  return user.staffProfile?.departmentId ?? null;
}

