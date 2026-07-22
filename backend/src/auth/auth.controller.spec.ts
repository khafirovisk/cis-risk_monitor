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

  it('login redireciona para /login?error=saml_falha quando a configuração de SAML é inválida (SAML lança exceção)', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    const { SAML } = require('@node-saml/node-saml');
    SAML.mockImplementationOnce(() => {
      throw new TypeError('cert is required');
    });

    await controller.login(res as any);

    expect(res.redirect).toHaveBeenCalledWith('/login?error=saml_falha');
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
    localAccounts.login.mockResolvedValue({ ok: true, mustChangePassword: true, mfaEnrollRequired: false, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    const res = makeRes();
    const req: any = { login: jest.fn((_user, cb) => cb(null)) };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', role: 'ADMIN', mustChangePassword: true }),
      expect.any(Function),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, mustChangePassword: true, mfaEnrollRequired: false });
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

  it('callback redireciona para /login?error=saml_falha quando a configuração de SAML é inválida (SAML lança exceção)', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    const req: any = { body: {}, login: jest.fn() };
    const { SAML } = require('@node-saml/node-saml');
    SAML.mockImplementationOnce(() => {
      throw new TypeError('cert is required');
    });

    await controller.callback(req, res as any);

    expect(res.redirect).toHaveBeenCalledWith('/login?error=saml_falha');
    expect(req.login).not.toHaveBeenCalled();
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

  it('localLogin não abre sessão quando a conta exige verificação de MFA, guarda o accountId pendente', async () => {
    localAccounts.login.mockResolvedValue({ ok: true, mfaRequired: true, id: 'acc-1' });
    const res = makeRes();
    const req: any = { session: {}, login: jest.fn() };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.session.pendingMfaAccountId).toBe('acc-1');
    expect(req.login).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mfaRequired: true });
  });

  it('mfaLoginVerify rejeita sem accountId pendente na sessão', async () => {
    const req: any = { session: {} };
    await expect(controller.mfaLoginVerify({ token: '000000' }, req, makeRes() as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mfaLoginVerify abre sessão e limpa o pendingMfaAccountId quando o token é válido', async () => {
    localAccounts.verifyMfaLogin = jest.fn().mockResolvedValue({ ok: true, mustChangePassword: false, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    const res = makeRes();
    const req: any = { session: { pendingMfaAccountId: 'acc-1' }, login: jest.fn((_user, cb) => cb(null)) };

    await controller.mfaLoginVerify({ token: '123456' }, req, res as any);

    expect(req.session.pendingMfaAccountId).toBeUndefined();
    expect(req.login).toHaveBeenCalledWith(expect.objectContaining({ id: 'acc-1' }), expect.any(Function));
  });

  it('mfaEnroll rejeita sem sessão local autenticada', async () => {
    const req: any = { isAuthenticated: () => false };
    await expect(controller.mfaEnroll(req)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mfaEnroll delega ao service com o id da sessão', async () => {
    localAccounts.startMfaEnrollment = jest.fn().mockResolvedValue({ secret: 'S', otpauthUrl: 'otpauth://x', qrDataUrl: 'data:image/png;base64,x' });
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true } };

    const result = await controller.mfaEnroll(req);

    expect(localAccounts.startMfaEnrollment).toHaveBeenCalledWith('acc-1');
    expect(result.secret).toBe('S');
  });

  it('mfaEnroll rejeita quando a sessão ainda tem troca de senha pendente (precedência sobre enroll de MFA)', async () => {
    localAccounts.startMfaEnrollment = jest.fn();
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true, mustChangePassword: true } };

    await expect(controller.mfaEnroll(req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(localAccounts.startMfaEnrollment).not.toHaveBeenCalled();
  });

  it('mfaEnrollVerify zera mfaEnrollRequired na sessão e retorna os códigos de backup', async () => {
    localAccounts.confirmMfaEnrollment = jest.fn().mockResolvedValue(['code-1', 'code-2']);
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true, mfaEnrollRequired: true } };

    const result = await controller.mfaEnrollVerify({ token: '123456' }, req);

    expect(req.user.mfaEnrollRequired).toBe(false);
    expect(result).toEqual({ backupCodes: ['code-1', 'code-2'] });
  });

  it('mfaEnrollVerify rejeita quando a sessão ainda tem troca de senha pendente (precedência sobre enroll de MFA)', async () => {
    localAccounts.confirmMfaEnrollment = jest.fn();
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true, mustChangePassword: true } };

    await expect(controller.mfaEnrollVerify({ token: '123456' }, req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(localAccounts.confirmMfaEnrollment).not.toHaveBeenCalled();
  });
});
