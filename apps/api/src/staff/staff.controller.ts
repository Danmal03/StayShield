import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateStaffDto } from './staff.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
@Roles(SystemRole.SYSTEM_OWNER, SystemRole.SECURITY_ADMINISTRATOR)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts in the current hotel group' })
  list(@Req() request: AuthenticatedRequest) {
    return this.staff.list(request.auth);
  }

  @Post()
  @ApiOperation({ summary: 'Create a staff account that can sign in' })
  create(@Body() input: CreateStaffDto, @Req() request: AuthenticatedRequest) {
    return this.staff.create(request.auth, input, request.ip);
  }
}
