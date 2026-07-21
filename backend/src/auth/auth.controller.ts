import { Controller, Get, Post, Req, Res, UseGuards, Redirect } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  // Inicia o SSO -> redireciona ao IdP
  @Get('login')
  @UseGuards(AuthGuard('saml'))
  login() {
    // o passport-saml faz o redirect
  }

  // ACS: IdP faz POST aqui após autenticar
  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  @Redirect()
  callback() {
    return { url: process.env.APP_BASE_URL || '/' };
  }

  @Get('me')
  me(@Req() req: Request) {
    if (req.isAuthenticated?.()) return req.user;
    if (process.env.NODE_ENV !== 'production' && !process.env.SAML_ENTRY_POINT) {
      return { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN', dev: true };
    }
    return { authenticated: false };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.logout?.(() => {
      req.session?.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
      });
    });
  }
}
