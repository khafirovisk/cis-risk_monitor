import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { SamlConfigService, SamlConfigInput } from './saml-config.service';

@Controller('auth/saml/config')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class SamlConfigController {
  constructor(private svc: SamlConfigService) {}

  @Get()
  get() {
    return this.svc.getConfig();
  }

  @Put()
  update(@Body() body: SamlConfigInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }
}
