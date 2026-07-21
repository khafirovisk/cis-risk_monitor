import { RolesGuard } from './roles.guard';

function makeContext(role: string | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as any;
}

describe('RolesGuard', () => {
  it('libera quando a rota não exige papéis', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('libera quando o papel do usuário está na lista exigida', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('bloqueia quando o papel do usuário não está na lista exigida', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('AUDITOR'))).toBe(false);
  });
});
