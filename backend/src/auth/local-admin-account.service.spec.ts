import * as bcrypt from 'bcryptjs';
import { LocalAdminAccountService } from './local-admin-account.service';

function makeAccount(overrides: Partial<any> = {}) {
  return {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin', 4),
    mustChangePassword: true,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LocalAdminAccountService', () => {
  let prisma: any;
  let service: LocalAdminAccountService;

  beforeEach(() => {
    prisma = { localAdminAccount: { findUnique: jest.fn(), update: jest.fn() } };
    service = new LocalAdminAccountService(prisma);
  });

  it('rejeita usuário diferente do cadastrado', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('outro', 'admin');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('aceita login correto e retorna mustChangePassword', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result.ok).toBe(true);
    expect(result.mustChangePassword).toBe(true);
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  });

  it('bloqueia após a 5ª tentativa errada', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount({ failedAttempts: 4 }));
    const result = await service.login('admin', 'senha-errada');
    expect(result.reason).toBe('locked');
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ failedAttempts: 0, lockedUntil: expect.any(Date) }),
    });
  });

  it('recusa login enquanto a conta estiver bloqueada', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(
      makeAccount({ lockedUntil: new Date(Date.now() + 60_000) }),
    );
    const result = await service.login('admin', 'admin');
    expect(result.reason).toBe('locked');
    expect(prisma.localAdminAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha exige a senha atual correta', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    await expect(service.changePassword('errada', 'nova12345')).rejects.toThrow('Senha atual incorreta');
  });

  it('troca de senha zera mustChangePassword', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    await service.changePassword('admin', 'nova12345');
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: expect.any(String), mustChangePassword: false },
    });
  });
});
