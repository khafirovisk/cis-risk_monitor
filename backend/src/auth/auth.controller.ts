import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SAML } from '@node-saml/node-saml';
import { PrismaService } from '../prisma/prisma.service';
import { SamlConfigService, SamlConfigDto } from './saml-config.service';
import { LocalAccountsService } from './local-accounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private samlConfig: SamlConfigService,
    private localAccounts: LocalAccountsService,
  ) {}

  // Inicia o SSO -> redireciona ao IdP. Config lida do banco a cada chamada
  // (via SamlConfigService, cacheada), então uma mudança salva na tela de
  // admin já vale na próxima tentativa de login, sem reiniciar o backend.
  @Get('login')
  async login(@Res() res: Response) {
    const config = await this.samlConfig.getConfig();
    if (!config.enabled || !config.entryPoint || !config.idpCert) {
      return res.redirect('/login?error=saml_indisponivel');
    }

    const saml = this.buildSaml(config);
    const url = await saml.getAuthorizeUrlAsync('', undefined, {});
    return res.redirect(url);
  }

  // ACS: IdP faz POST aqui após autenticar
  @Post('saml/callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const config = await this.samlConfig.getConfig();
    if (!config.enabled || !config.entryPoint || !config.idpCert) {
      return res.redirect('/login?error=saml_indisponivel');
    }

    const saml = this.buildSaml(config);
    let user: { id: string; email: string; name: string | null; role: string };
    try {
      const { profile } = await saml.validatePostResponseAsync(req.body as Record<string, string>);
      user = await this.upsertSamlUser(profile);
    } catch {
      return res.redirect('/login?error=saml_falha');
    }

    req.login(user, (err) => {
      if (err) return res.redirect('/login?error=saml_falha');
      res.redirect(process.env.APP_BASE_URL || '/');
    });
  }

  @Post('local/login')
  @HttpCode(HttpStatus.OK)
  async localLogin(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.localAccounts.login(body.username, body.password);
    if (!result.ok) {
      // HttpStatus enum nesta versão do @nestjs/common não tem LOCKED (423 RFC 4918/WebDAV).
      const status = result.reason === 'locked' ? 423 : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    if (result.mfaRequired) {
      (req.session as any).pendingMfaAccountId = result.id;
      return res.json({ ok: true, mfaRequired: true });
    }

    const user = {
      id: result.id,
      username: result.username,
      role: result.role,
      mustChangePassword: result.mustChangePassword,
      mfaEnrollRequired: result.mfaEnrollRequired,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword, mfaEnrollRequired: result.mfaEnrollRequired });
    });
  }

  @Post('local/mfa/login-verify')
  @HttpCode(HttpStatus.OK)
  async mfaLoginVerify(
    @Body() body: { token: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pendingId = (req.session as any)?.pendingMfaAccountId;
    if (!pendingId) throw new UnauthorizedException();

    const result = await this.localAccounts.verifyMfaLogin(pendingId, body.token);
    if (!result.ok) {
      const status = result.reason === 'locked' ? 423 : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    delete (req.session as any).pendingMfaAccountId;
    const user = {
      id: result.id,
      username: result.username,
      role: result.role,
      mustChangePassword: result.mustChangePassword,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword });
    });
  }

  @Post('local/mfa/enroll')
  async mfaEnroll(@Req() req: Request) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) throw new UnauthorizedException();
    return this.localAccounts.startMfaEnrollment((req.user as any).id);
  }

  @Post('local/mfa/enroll/verify')
  async mfaEnrollVerify(@Body() body: { token: string }, @Req() req: Request) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) throw new UnauthorizedException();
    const backupCodes = await this.localAccounts.confirmMfaEnrollment((req.user as any).id, body.token);
    if (req.user) (req.user as any).mfaEnrollRequired = false;
    return { backupCodes };
  }

  @Post('local/change-password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
  ) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) {
      throw new UnauthorizedException();
    }
    await this.localAccounts.changePassword((req.user as any).id, body.currentPassword, body.newPassword);
    if (req.user) (req.user as any).mustChangePassword = false;
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    if (req.isAuthenticated?.()) return req.user;
    if (process.env.NODE_ENV !== 'production') {
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

  private buildSaml(config: SamlConfigDto) {
    return new SAML({
      entryPoint: config.entryPoint!,
      issuer: config.issuer,
      callbackUrl: config.callbackUrl || undefined,
      idpCert: config.idpCert!,
      wantAssertionsSigned: config.wantAssertionsSigned,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    } as any);
  }

  private async upsertSamlUser(profile: any) {
    const email =
      (profile.email as string) ||
      (profile.nameID as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string);

    if (!email) throw new Error('SAML sem e-mail/NameID');

    const name =
      (profile.displayName as string) ||
      (profile.name as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ||
      email;

    const roleClaim = (profile.role as string)?.toUpperCase();
    const role = ['ADMIN', 'AUDITOR', 'LEITOR'].includes(roleClaim) ? roleClaim : 'AUDITOR';

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, samlNameId: profile.nameID as string },
      create: { email, name, samlNameId: profile.nameID as string, role: role as any },
    });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
