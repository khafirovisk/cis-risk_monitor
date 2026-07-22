import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiSettingsService, AiSettingsInput } from './ai-settings.service';

@Controller('ai-settings')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class AiSettingsController {
  constructor(private svc: AiSettingsService) {}

  @Get()
  get() {
    return this.svc.getConfig();
  }

  @Put()
  update(@Body() body: AiSettingsInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }
}
