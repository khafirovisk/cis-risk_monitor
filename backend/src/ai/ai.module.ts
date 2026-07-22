import { Module } from '@nestjs/common';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiClassifierService } from './ai-classifier.service';

@Module({
  controllers: [AiSettingsController],
  providers: [AiSettingsService, AiClassifierService],
  exports: [AiSettingsService, AiClassifierService],
})
export class AiModule {}
