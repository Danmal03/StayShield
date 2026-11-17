import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  AssignDepartmentDto,
  AssignTrainingDto,
  ChangePasswordDto,
  CreateAnnouncementDto,
  CreatePersonalDeviceDto,
  CreateSecurityReportDto,
  CreateStaffRequestDto,
  CreateTrainingCourseDto,
  DepartmentDto,
  ReviewPersonalDeviceDto,
  SubmitTrainingDto,
  UpdateStaffProfileDto,
  UpdateStaffRequestDto,
} from './staff-portal.dto';
import { StaffPortalService } from './staff-portal.service';

const adminRoles = [SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR];

@ApiTags('staff self-service')
@Controller('staff-portal')
export class StaffPortalController {
  constructor(private readonly portal: StaffPortalService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get the authenticated employee’s own portal information' })
  overview(@Req() request: AuthenticatedRequest) {
    return this.portal.overview(request.auth);
  }

  @Patch('profile')
  updateProfile(
    @Body() input: UpdateStaffProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.updateProfile(request.auth, input, request.ip);
  }

  @Get('devices')
  listDevices(@Req() request: AuthenticatedRequest) {
    return this.portal.listDevices(request.auth);
  }

  @Post('devices')
  createDevice(
    @Body() input: CreatePersonalDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createDevice(request.auth, input, request.ip);
  }

  @Get('requests')
  listRequests(@Req() request: AuthenticatedRequest) {
    return this.portal.listOwnRequests(request.auth);
  }

  @Post('requests')
  createRequest(
    @Body() input: CreateStaffRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createRequest(request.auth, input, request.ip);
  }

  @Get('reports')
  listReports(@Req() request: AuthenticatedRequest) {
    return this.portal.listOwnReports(request.auth);
  }

  @Post('reports')
  createReport(
    @Body() input: CreateSecurityReportDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createSecurityReport(request.auth, input, request.ip);
  }

  @Get('announcements')
  listAnnouncements(@Req() request: AuthenticatedRequest) {
    return this.portal.listAnnouncements(request.auth);
  }

  @Get('training')
  listTraining(@Req() request: AuthenticatedRequest) {
    return this.portal.listTraining(request.auth);
  }

  @Post('training/:assignmentId/completions')
  completeTraining(
    @Param('assignmentId', new ParseUUIDPipe({ version: '4' })) assignmentId: string,
    @Body() input: SubmitTrainingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.submitTraining(request.auth, assignmentId, input, request.ip);
  }

  @Get('notifications')
  listNotifications(@Req() request: AuthenticatedRequest) {
    return this.portal.listNotifications(request.auth);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.markNotificationRead(request.auth, id);
  }

  @Get('sessions')
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.portal.listSessions(request.auth);
  }

  @Delete('sessions/:id')
  revokeSession(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.revokeSession(request.auth, id);
  }

  @Get('login-history')
  loginHistory(@Req() request: AuthenticatedRequest) {
    return this.portal.loginHistory(request.auth);
  }

  @Post('password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(
    @Body() input: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.changePassword(request.auth, input, request.ip);
  }

  @Get('admin/overview')
  @Roles(...adminRoles)
  @ApiOperation({ summary: 'List the current tenant’s self-service queues for administrators' })
  adminOverview(@Req() request: AuthenticatedRequest) {
    return this.portal.adminOverview(request.auth.tenantId);
  }

  @Patch('admin/requests/:id')
  @Roles(...adminRoles)
  updateRequest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateStaffRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.updateRequest(request.auth, id, input, request.ip);
  }

  @Patch('admin/devices/:id')
  @Roles(...adminRoles)
  reviewDevice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ReviewPersonalDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.reviewDevice(request.auth, id, input.status, request.ip);
  }

  @Patch('admin/staff/:userId/department')
  @Roles(...adminRoles)
  assignDepartment(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() input: AssignDepartmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.assignDepartment(request.auth, userId, input.departmentId ?? null, request.ip);
  }

  @Get('admin/departments')
  @Roles(...adminRoles)
  listDepartments(@Req() request: AuthenticatedRequest) {
    return this.portal.listDepartments(request.auth);
  }

  @Post('admin/departments')
  @Roles(...adminRoles)
  createDepartment(
    @Body() input: DepartmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createDepartment(request.auth, input, request.ip);
  }

  @Patch('admin/departments/:id')
  @Roles(...adminRoles)
  updateDepartment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: DepartmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.updateDepartment(request.auth, id, input, request.ip);
  }

  @Delete('admin/departments/:id')
  @Roles(...adminRoles)
  deleteDepartment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.deleteDepartment(request.auth, id, request.ip);
  }

  @Post('admin/announcements')
  @Roles(...adminRoles)
  createAnnouncement(
    @Body() input: CreateAnnouncementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createAnnouncement(request.auth, input, request.ip);
  }

  @Post('admin/training-courses')
  @Roles(...adminRoles)
  createTrainingCourse(
    @Body() input: CreateTrainingCourseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.createTrainingCourse(request.auth, input, request.ip);
  }

  @Post('admin/training-courses/:courseId/assignments')
  @Roles(...adminRoles)
  assignTraining(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body() input: AssignTrainingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.portal.assignTraining(request.auth, courseId, input, request.ip);
  }
}
