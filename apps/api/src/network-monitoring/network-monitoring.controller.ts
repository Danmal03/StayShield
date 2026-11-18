import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles, Public } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateNetworkIntegrationDto, NetworkProviderEventDto } from './network-monitoring.dto';
import { NetworkMonitoringService } from './network-monitoring.service';

const networkAdminRoles = [
  SystemRole.SYSTEM_OWNER,
  SystemRole.SECURITY_ADMINISTRATOR,
  SystemRole.NETWORK_ADMINISTRATOR,
];

@ApiTags('network monitoring')
@Controller('staff-portal/network')
export class NetworkMonitoringController {
  constructor(private readonly monitoring: NetworkMonitoringService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the authenticated employee’s current network connection' })
  current(@Req() request: AuthenticatedRequest) {
    return this.monitoring.current(request.auth);
  }

  @Get('history')
  @ApiOperation({ summary: 'List the authenticated employee’s own network connection history' })
  history(@Req() request: AuthenticatedRequest) {
    return this.monitoring.history(request.auth);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get network integration freshness for the authenticated employee’s tenant' })
  status(@Req() request: AuthenticatedRequest) {
    return this.monitoring.status(request.auth);
  }

  @Get('admin/sessions')
  @Roles(...networkAdminRoles)
  adminSessions(@Req() request: AuthenticatedRequest) {
    return this.monitoring.adminSessions(request.auth);
  }

  @Get('admin/integrations')
  @Roles(...networkAdminRoles)
  adminIntegrations(@Req() request: AuthenticatedRequest) {
    return this.monitoring.adminIntegrations(request.auth);
  }

  @Post('admin/integrations')
  @Roles(...networkAdminRoles)
  createIntegration(
    @Body() input: CreateNetworkIntegrationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.monitoring.createIntegration(request.auth, input, request.ip);
  }

  @Delete('admin/integrations/:id')
  @Roles(...networkAdminRoles)
  disableIntegration(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.monitoring.disableIntegration(request.auth, id, request.ip);
  }
}

@ApiTags('network provider integration')
@Controller('network-provider')
export class NetworkProviderController {
  constructor(private readonly monitoring: NetworkMonitoringService) {}

  @Post('events')
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Receive a normalized event from a configured network integration' })
  ingest(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: NetworkProviderEventDto,
  ) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    return this.monitoring.ingest(token, input);
  }
}
