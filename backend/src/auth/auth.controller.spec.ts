jest.mock('@node-saml/node-saml', () => ({
  SAML: jest.fn().mockImplementation(() => ({
    getAuthorizeUrlAsync: jest.fn().mockResolvedValue('https://idp.example.com/sso?SAMLRequest=xyz'),
    validatePostResponseAsync: jest.fn().mockResolvedValue({
      profile: { email: 'ana@empresa.com', displayName: 'Ana', role: 'admin' },
    }),
  })),
}));

import { AuthController } from './auth.controller';
import { UnauthorizedException } from '@nestjs/common';

function makeRes() {
  return { redirect: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
}

describe('AuthController', () => {
  let prisma: any;
  let samlConfig: any;
  let localAccounts: any;
  let controller: AuthController;

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn().mockResolvedValue({ id: 'u1', email: 'ana@empresa.com', name: 'Ana', role: 'ADMIN' }) } };
    samlConfig = { getConfig: jest.fn() };
    localAccounts = { login: jest.fn(), changePassword: jest.fn() };
    controller = new AuthController(prisma, samlConfig, localAccounts);
  });

  it('login redireciona para /login?error=saml_indisponivel quando desabilitado', async () => {
    samlConfig.getConfig.mockResolvedValue({ enabled: false, entryPoint: null, idpCert: null });
    const res = makeRes();
    await controller.login(res as any);
    expect(res.redirect).toHaveBeenCalledWith('/login?error=saml_indisponivel');
  });

  it('login redireciona para a URL do IdP quando habilitado', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    await controller.login(res as any);
    expect(res.redirect).toHaveBeenCalledWith('https://idp.example.com/sso?SAMLRequest=xyz');
  });

  it('callback faz upsert do usuário com o role vindo do claim', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    const req: any = { body: {}, login: jest.fn((_user, cb) => cb(null)) };

    await controller.callback(req, res as any);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'ana@empresa.com' },
      update: { name: 'Ana', samlNameId: undefined },
      create: { email: 'ana@empresa.com', name: 'Ana', samlNameId: undefined, role: 'ADMIN' },
    });
    expect(req.login).toHaveBeenCalled();
  });

  it('localLogin retorna 423 quando a conta está bloqueada', async () => {
    localAccounts.login.mockResolvedValue({ ok: false, reason: 'locked', lockedUntilMs: Date.now() + 60_000 });
    const res = makeRes();
    const req: any = {};

    await controller.localLogin({ username: 'admin', password: 'x' }, req, res as any);

    expect(res.status).toHaveBeenCalledWith(423);
  });

  it('localLogin abre sessão quando as credenciais estão corretas', async () => {
    localAccounts.login.mockResolvedValue({ ok: true, mustChangePassword: true, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    const res = makeRes();
    const req: any = { login: jest.fn((_user, cb) => cb(null)) };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', role: 'ADMIN', mustChangePassword: true }),
      expect.any(Function),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, mustChangePassword: true });
  });

  it('changePassword delega ao LocalAccountsService quando há sessão local autenticada', async () => {
    const req: any = {
      isAuthenticated: () => true,
      user: { id: 'acc-1', mustChangePassword: true, local: true },
    };
    await controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req);
    expect(localAccounts.changePassword).toHaveBeenCalledWith('acc-1', 'admin', 'nova12345');
    expect(req.user.mustChangePassword).toBe(false);
  });

  it('changePassword rejeita com UnauthorizedException quando não há sessão autenticada', async () => {
    const req: any = { isAuthenticated: () => false, user: undefined };

    await expect(
      controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(localAccounts.changePassword).not.toHaveBeenCalled();
  });

  it('changePassword rejeita com UnauthorizedException quando isAuthenticated está ausente', async () => {
    const req: any = { user: { mustChangePassword: true, local: true } };

    await expect(
      controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(localAccounts.changePassword).not.toHaveBeenCalled();
  });

  it('changePassword rejeita com UnauthorizedException quando a sessão não é da conta local', async () => {
    const req: any = { isAuthenticated: () => true, user: { mustChangePassword: false } };

    await expect(
      controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(localAccounts.changePassword).not.toHaveBeenCalled();
  });

  it('callback redireciona para /login?error=saml_falha quando validatePostResponseAsync rejeita', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    const req: any = { body: {}, login: jest.fn() };

    // Mock validatePostResponseAsync to reject
    const { SAML } = require('@node-saml/node-saml');
    const mockSamlInstance = { validatePostResponseAsync: jest.fn().mockRejectedValueOnce(new Error('invalid SAML response')) };
    SAML.mockImplementation(() => mockSamlInstance);

    await controller.callback(req, res as any);

    expect(res.redirect).toHaveBeenCalledWith('/login?error=saml_falha');
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(req.login).not.toHaveBeenCalled();
  });
});
