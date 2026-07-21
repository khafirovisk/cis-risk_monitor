jest.mock('@node-saml/node-saml', () => ({
  SAML: jest.fn().mockImplementation(() => ({
    getAuthorizeUrlAsync: jest.fn().mockResolvedValue('https://idp.example.com/sso?SAMLRequest=xyz'),
    validatePostResponseAsync: jest.fn().mockResolvedValue({
      profile: { email: 'ana@empresa.com', displayName: 'Ana', role: 'admin' },
    }),
  })),
}));

import { AuthController } from './auth.controller';

function makeRes() {
  return { redirect: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
}

describe('AuthController', () => {
  let prisma: any;
  let samlConfig: any;
  let localAdmin: any;
  let controller: AuthController;

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn().mockResolvedValue({ id: 'u1', email: 'ana@empresa.com', name: 'Ana', role: 'ADMIN' }) } };
    samlConfig = { getConfig: jest.fn() };
    localAdmin = { login: jest.fn(), changePassword: jest.fn() };
    controller = new AuthController(prisma, samlConfig, localAdmin);
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
    localAdmin.login.mockResolvedValue({ ok: false, reason: 'locked', lockedUntilMs: Date.now() + 60_000 });
    const res = makeRes();
    const req: any = {};

    await controller.localLogin({ username: 'admin', password: 'x' }, req, res as any);

    expect(res.status).toHaveBeenCalledWith(423);
  });

  it('localLogin abre sessão quando as credenciais estão corretas', async () => {
    localAdmin.login.mockResolvedValue({ ok: true, mustChangePassword: true, username: 'admin' });
    const res = makeRes();
    const req: any = { login: jest.fn((_user, cb) => cb(null)) };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-admin', role: 'ADMIN', mustChangePassword: true }),
      expect.any(Function),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, mustChangePassword: true });
  });

  it('changePassword delega ao LocalAdminAccountService', async () => {
    const req: any = { user: { mustChangePassword: true } };
    await controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req);
    expect(localAdmin.changePassword).toHaveBeenCalledWith('admin', 'nova12345');
    expect(req.user.mustChangePassword).toBe(false);
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
