import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BrandingService, BrandingInput } from './branding.service';

const ALLOWED_LOGO_MIMES = ['image/png', 'image/jpeg'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

@Controller('branding')
export class BrandingController {
  constructor(private svc: BrandingService) {}

  // Público — a tela de login precisa da cor/logo antes de qualquer sessão existir.
  @Get()
  get() {
    return this.svc.getConfig();
  }

  // Público, mesmo motivo. Sem Content-Disposition: precisa renderizar inline num <img>.
  @Get('logo')
  async logo(@Res() res: Response) {
    const file = await this.svc.getLogoFile();
    if (!file) throw new NotFoundException('Nenhuma logo configurada');
    res.setHeader('Content-Type', file.mime);
    res.sendFile(file.path);
  }

  @Put()
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Body() body: BrandingInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }

  @Post('logo')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_LOGO_SIZE } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!ALLOWED_LOGO_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido — envie PNG ou JPEG');
    }
    return this.svc.setLogo(file, (req.user as any)?.email || (req.user as any)?.username);
  }

  @Delete('logo')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('ADMIN')
  removeLogo(@Req() req: Request) {
    return this.svc.removeLogo((req.user as any)?.email || (req.user as any)?.username);
  }
}
