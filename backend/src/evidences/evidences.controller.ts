import { Controller, Delete, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EvidencesService } from './evidences.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('evidences')
@UseGuards(AuthenticatedGuard)
export class EvidencesController {
  constructor(private svc: EvidencesService) {}

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const evidence = await this.svc.findOne(id);
    if (!evidence) throw new NotFoundException('Evidência não encontrada');
    res.setHeader('Content-Type', evidence.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.filename)}"`);
    res.sendFile(this.svc.filePath(evidence));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const evidence = await this.svc.findOne(id);
    if (!evidence) throw new NotFoundException('Evidência não encontrada');
    await this.svc.remove(evidence);
    return { ok: true };
  }
}
