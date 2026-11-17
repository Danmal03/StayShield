import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreateDeviceDto,
  CreateEventDto,
  CreateIncidentDto,
  CreatePolicyDto,
  AuditActorHistoryQueryDto,
  UpdateDeviceDto,
  UpdateEventDto,
  UpdateIncidentDto,
  UpdatePolicyDto,
} from './operations.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('workspace')
  @ApiOperation({ summary: 'Role-scoped hotel security workspace' })
  workspace(@Req() request: AuthenticatedRequest) {
    return this.operations.workspace(request.auth);
  }

  @Get('audit')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR, SystemRole.AUDITOR)
  @ApiOperation({ summary: 'List the latest audit entries for the current hotel group' })
  listAudit(@Req() request: AuthenticatedRequest) {
    return this.operations.listAudit(request.auth);
  }

  @Get('audit/actors')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR, SystemRole.AUDITOR)
  @ApiOperation({ summary: 'List tenant users grouped into administrators and users' })
  listAuditActors(@Req() request: AuthenticatedRequest) {
    return this.operations.listAuditActors(request.auth);
  }

  @Get('audit/actors/:actorId')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR, SystemRole.AUDITOR)
  @ApiOperation({ summary: 'List paginated audit activity for a tenant user' })
  listActorAudit(
    @Param('actorId', new ParseUUIDPipe({ version: '4' })) actorId: string,
    @Query() query: AuditActorHistoryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.listActorAudit(request.auth, actorId, query.cursor);
  }

  @Get('audit/flags')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR, SystemRole.AUDITOR)
  @ApiOperation({ summary: 'List accounts with recent activity signals for review' })
  listAuditFlags(@Req() request: AuthenticatedRequest) {
    return this.operations.listAuditFlags(request.auth);
  }

  @Get('devices')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.NETWORK_ADMINISTRATOR,
    SystemRole.IT_SUPPORT,
    SystemRole.READ_ONLY_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List network devices for the current hotel group' })
  listDevices(@Req() request: AuthenticatedRequest) {
    return this.operations.listDevices(request.auth);
  }

  @Post('devices')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR)
  @ApiOperation({ summary: 'Add a network device to the current hotel group' })
  createDevice(@Body() input: CreateDeviceDto, @Req() request: AuthenticatedRequest) {
    return this.operations.createDevice(request.auth, input, request.ip);
  }

  @Patch('devices/:id')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.NETWORK_ADMINISTRATOR,
    SystemRole.IT_SUPPORT,
  )
  @ApiOperation({ summary: 'Update a network device' })
  updateDevice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.updateDevice(request.auth, id, input, request.ip);
  }

  @Delete('devices/:id')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR)
  @ApiOperation({ summary: 'Quarantine a network device' })
  quarantineDevice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.quarantineDevice(request.auth, id, request.ip);
  }

  @Post('devices/:id/restore')
  @Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR)
  @ApiOperation({ summary: 'Resolve and restore a quarantined network device' })
  restoreDevice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.restoreDevice(request.auth, id, request.ip);
  }

  @Get('events')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
    SystemRole.READ_ONLY_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List security events for the current hotel group' })
  listEvents(@Req() request: AuthenticatedRequest) {
    return this.operations.listEvents(request.auth);
  }

  @Post('events')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
  )
  @ApiOperation({ summary: 'Record a security event' })
  createEvent(@Body() input: CreateEventDto, @Req() request: AuthenticatedRequest) {
    return this.operations.createEvent(request.auth, input, request.ip);
  }

  @Patch('events/:id')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
  )
  @ApiOperation({ summary: 'Update or triage a security event' })
  updateEvent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.updateEvent(request.auth, id, input, request.ip);
  }

  @Get('policies')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.DATA_PROTECTION_OFFICER,
    SystemRole.HOTEL_MANAGEMENT,
    SystemRole.READ_ONLY_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List security policies for the current hotel group' })
  listPolicies(@Req() request: AuthenticatedRequest) {
    return this.operations.listPolicies(request.auth);
  }

  @Post('policies')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.DATA_PROTECTION_OFFICER,
  )
  @ApiOperation({ summary: 'Create a security policy' })
  createPolicy(@Body() input: CreatePolicyDto, @Req() request: AuthenticatedRequest) {
    return this.operations.createPolicy(request.auth, input, request.ip);
  }

  @Patch('policies/:id')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.DATA_PROTECTION_OFFICER,
  )
  @ApiOperation({ summary: 'Update or archive a security policy' })
  updatePolicy(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePolicyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.updatePolicy(request.auth, id, input, request.ip);
  }

  @Get('incidents')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
    SystemRole.IT_SUPPORT,
    SystemRole.HOTEL_MANAGEMENT,
    SystemRole.READ_ONLY_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List incidents for the current hotel group' })
  listIncidents(@Req() request: AuthenticatedRequest) {
    return this.operations.listIncidents(request.auth);
  }

  @Post('incidents')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
    SystemRole.IT_SUPPORT,
  )
  @ApiOperation({ summary: 'Open an incident' })
  createIncident(@Body() input: CreateIncidentDto, @Req() request: AuthenticatedRequest) {
    return this.operations.createIncident(request.auth, input, request.ip);
  }

  @Patch('incidents/:id')
  @Roles(
    SystemRole.SYSTEM_OWNER,
    SystemRole.SECURITY_ADMINISTRATOR,
    SystemRole.SECURITY_ANALYST,
    SystemRole.IT_SUPPORT,
  )
  @ApiOperation({ summary: 'Update or resolve an incident' })
  updateIncident(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateIncidentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.updateIncident(request.auth, id, input, request.ip);
  }
}
