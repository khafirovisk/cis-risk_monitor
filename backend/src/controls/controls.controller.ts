import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ControlsService } from './controls.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('controls')
@UseGuards(AuthenticatedGuard)
export class ControlsController {
  constructor(private svc: ControlsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':number')
  findOne(@Param('number', ParseIntPipe) number: number) {
    return this.svc.findOne(number);
  }
}
