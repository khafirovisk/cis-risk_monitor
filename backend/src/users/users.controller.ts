import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get()
  list() {
    return this.svc.list();
  }
}
