import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ControlsModule } from './controls/controls.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { RisksModule } from './risks/risks.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrismaModule, AuthModule, ControlsModule, AssessmentsModule, RisksModule],
  controllers: [HealthController],
})
export class AppModule {}
