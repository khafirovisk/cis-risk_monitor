import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AssessmentsService } from './assessments.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('assessments')
@UseGuards(AuthenticatedGuard)
export class AssessmentsController {
  constructor(private svc: AssessmentsService) {}

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
}
