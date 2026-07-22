import {
  Body, Controller, Get, Param, Post, Put, Req, UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { AssessmentsService } from './assessments.service';
import { EvidencesService } from '../evidences/evidences.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('assessments')
@UseGuards(AuthenticatedGuard)
export class AssessmentsController {
  constructor(private svc: AssessmentsService, private evidences: EvidencesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: { name: string; scopeIg?: number }, @Req() req: Request) {
    return this.svc.create({ ...body, createdBy: (req.user as any)?.email });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getWithItems(id);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.svc.summary(id);
  }

  @Put(':id/items/:safeguardId')
  setItem(
    @Param('id') id: string,
    @Param('safeguardId') safeguardId: string,
    @Body() body: { maturity?: number | null; na?: boolean; evidenceText?: string },
    @Req() req: Request,
  ) {
    return this.svc.setItem(id, safeguardId, { ...body, updatedBy: (req.user as any)?.email });
  }

  @Post(':id/items/:safeguardId/evidences')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEvidences(
    @Param('id') id: string,
    @Param('safeguardId') safeguardId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const item = await this.svc.ensureItem(id, safeguardId);
    return this.evidences.saveMany(item.id, files ?? [], (req.user as any)?.email);
  }
}
