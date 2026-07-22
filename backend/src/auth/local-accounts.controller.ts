import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { LocalAccountsService, CreateLocalAccountInput } from './local-accounts.service';

@Controller('local-accounts')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class LocalAccountsController {
  constructor(private svc: LocalAccountsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: CreateLocalAccountInput) {
    if (!body.password || typeof body.password !== 'string') {
      throw new BadRequestException('Senha é obrigatória');
    }
    if (!['ADMIN', 'AUDITOR', 'LEITOR'].includes(body.role)) {
      throw new BadRequestException('Papel inválido');
    }
    return this.svc.create(body);
  }

  @Post(':id/reset-mfa')
  async resetMfa(@Param('id') id: string) {
    await this.svc.resetMfa(id);
    return { ok: true };
  }
}
