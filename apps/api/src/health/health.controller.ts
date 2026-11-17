import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic application health check' })
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'stayshield-api',
      timestamp: new Date().toISOString(),
    };
  }
}
