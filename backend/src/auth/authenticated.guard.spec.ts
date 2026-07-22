import { AuthenticatedGuard } from './authenticated.guard';

function makeContext(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('AuthenticatedGuard', () => {
  const guard = new AuthenticatedGuard();
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('bloqueia quando mustChangePassword é true, mesmo autenticado', () => {
    const req = { isAuthenticated: () => true, user: { role: 'ADMIN', mustChangePassword: true } };
    expect(guard.canActivate(makeContext(req))).toBe(false);
  });

  it('libera quando autenticado e mustChangePassword é false', () => {
    const req = { isAuthenticated: () => true, user: { role: 'ADMIN', mustChangePassword: false } };
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it('bloqueia quando mfaEnrollRequired é true, mesmo autenticado e mustChangePassword false', () => {
    const req = { isAuthenticated: () => true, user: { role: 'ADMIN', mustChangePassword: false, mfaEnrollRequired: true } };
    expect(guard.canActivate(makeContext(req))).toBe(false);
  });

  it('em produção, sem sessão, bloqueia', () => {
    process.env.NODE_ENV = 'production';
    const req = { isAuthenticated: () => false };
    expect(guard.canActivate(makeContext(req))).toBe(false);
  });
});
