import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RisksService } from './risks.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('risks')
@UseGuards(AuthenticatedGuard)
export class RisksController {
  constructor(private svc: RisksService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
