import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { EvidencesModule } from '../evidences/evidences.module';

@Module({
  imports: [EvidencesModule],
  providers: [AssessmentsService],
  controllers: [AssessmentsController],
})
export class AssessmentsModule {}
