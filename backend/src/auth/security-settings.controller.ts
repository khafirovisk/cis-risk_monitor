import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { SecuritySettingsService, SecuritySettingsInput } from './security-settings.service';

@Controller('security-settings')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class SecurityController {
  constructor(private svc: SecuritySettingsService) {}

  @Get()
  get() {
    return this.svc.getConfig();
  }

  @Put()
  update(@Body() body: SecuritySettingsInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }
}
