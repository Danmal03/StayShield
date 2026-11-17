import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { StaffPortalController } from './staff-portal.controller';
import { StaffPortalService } from './staff-portal.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffPortalController],
  providers: [StaffPortalService],
})
export class StaffPortalModule {}
