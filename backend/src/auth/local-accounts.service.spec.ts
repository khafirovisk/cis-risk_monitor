import * as bcrypt from 'bcryptjs';
import { LocalAccountsService } from './local-accounts.service';

function makeAccount(overrides: Partial<any> = {}) {
  return {
    id: 'acc-1',
    username: 'admin',
    name: null,
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('admin', 4),
    mustChangePassword: true,
    failedAttempts: 0,
    lockedUntil: null,
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const DEFAULT_POLICY = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSymbol: false,
  mfaRequired: false,
  updatedBy: null,
  updatedAt: new Date(),
};

describe('LocalAccountsService', () => {
  let prisma: any;
  let security: any;
  let service: LocalAccountsService;

  beforeEach(() => {
    prisma = {
      localAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    security = { getConfig: jest.fn().mockResolvedValue(DEFAULT_POLICY) };
    service = new LocalAccountsService(prisma, security);
  });

  it('rejeita usuário inexistente', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(null);
    const result = await service.login('ninguem', 'x');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('aceita login correto e retorna id/username/role/mustChangePassword', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result).toEqual({ ok: true, mustChangePassword: true, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  });

  it('bloqueia após a 5ª tentativa errada', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ failedAttempts: 4 }));
    const result = await service.login('admin', 'senha-errada');
    expect(result.reason).toBe('locked');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: expect.objectContaining({ failedAttempts: 0, lockedUntil: expect.any(Date) }),
    });
  });

  it('recusa login enquanto a conta estiver bloqueada', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ lockedUntil: new Date(Date.now() + 60_000) }));
    const result = await service.login('admin', 'admin');
    expect(result.reason).toBe('locked');
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha exige a senha atual correta', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    await expect(service.changePassword('acc-1', 'errada', 'nova12345')).rejects.toThrow('Senha atual incorreta');
  });

  it('troca de senha valida a política antes de gravar', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, passwordMinLength: 20 });
    await expect(service.changePassword('acc-1', 'admin', 'curta')).rejects.toThrow(/ao menos 20 caracteres/);
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha zera mustChangePassword quando válida', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    await service.changePassword('acc-1', 'admin', 'nova12345');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { passwordHash: expect.any(String), mustChangePassword: false },
    });
  });

  it('list retorna só os campos públicos ordenados por criação', async () => {
    prisma.localAccount.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.localAccount.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, name: true, role: true,
        mustChangePassword: true, mfaEnabled: true, lockedUntil: true, createdAt: true,
      },
    });
  });

  it('create valida a política de senha antes de criar', async () => {
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, passwordMinLength: 20 });
    await expect(
      service.create({ username: 'novo', role: 'AUDITOR', password: 'curta' }),
    ).rejects.toThrow(/ao menos 20 caracteres/);
    expect(prisma.localAccount.create).not.toHaveBeenCalled();
  });

  it('create grava com mustChangePassword true e retorna o resumo', async () => {
    prisma.localAccount.create.mockResolvedValue(makeAccount({ id: 'acc-2', username: 'novo', role: 'AUDITOR', mustChangePassword: true }));
    const result = await service.create({ username: 'novo', role: 'AUDITOR', password: 'senha1234' });
    expect(prisma.localAccount.create).toHaveBeenCalledWith({
      data: { username: 'novo', name: null, role: 'AUDITOR', passwordHash: expect.any(String), mustChangePassword: true },
    });
    expect(result).toEqual(expect.objectContaining({ id: 'acc-2', username: 'novo', role: 'AUDITOR' }));
  });
});
