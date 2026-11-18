import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { NetworkMonitoringController, NetworkProviderController } from './network-monitoring.controller';
import { NetworkMonitoringService } from './network-monitoring.service';

@Module({
  imports: [PrismaModule],
  controllers: [NetworkMonitoringController, NetworkProviderController],
  providers: [NetworkMonitoringService],
})
export class NetworkMonitoringModule {}
