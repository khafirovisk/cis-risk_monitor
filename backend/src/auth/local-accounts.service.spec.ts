import * as bcrypt from 'bcryptjs';
import { LocalAccountsService } from './local-accounts.service';

function authenticatorSecret(): string {
  const { authenticator } = require('otplib');
  return authenticator.generateSecret();
}

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
    expect(result).toEqual({ ok: true, mustChangePassword: true, mfaEnrollRequired: false, id: 'acc-1', username: 'admin', role: 'ADMIN' });
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

  it('login com mfaEnabled não abre sessão, pede verificação de TOTP', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET' }));
    const result = await service.login('admin', 'admin');
    expect(result).toEqual({ ok: true, mfaRequired: true, id: 'acc-1' });
  });

  it('login reporta mfaEnrollRequired quando MFA é obrigatório globalmente e a conta não tem MFA', async () => {
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, mfaRequired: true });
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result.mfaEnrollRequired).toBe(true);
  });

  it('startMfaEnrollment gera um segredo e retorna QR', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const enrollment = await service.startMfaEnrollment('acc-1');
    expect(enrollment.secret).toEqual(expect.any(String));
    expect(enrollment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { mfaSecret: enrollment.secret } });
  });

  it('confirmMfaEnrollment rejeita token inválido e não habilita MFA', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaSecret: authenticatorSecret() }));
    await expect(service.confirmMfaEnrollment('acc-1', '000000')).rejects.toThrow('Código inválido');
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('confirmMfaEnrollment habilita MFA e retorna 10 códigos de backup em claro', async () => {
    const secret = authenticatorSecret();
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaSecret: secret }));
    const { authenticator } = require('otplib');
    const token = authenticator.generate(secret);

    const codes = await service.confirmMfaEnrollment('acc-1', token);

    expect(codes).toHaveLength(10);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { mfaEnabled: true, mfaBackupCodes: expect.any(Array) },
    });
  }, 15000);

  it('verifyMfaLogin aceita um TOTP válido', async () => {
    const secret = authenticatorSecret();
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: secret }));
    const { authenticator } = require('otplib');
    const token = authenticator.generate(secret);

    const result = await service.verifyMfaLogin('acc-1', token);

    expect(result.ok).toBe(true);
  });

  it('verifyMfaLogin aceita e consome um código de backup válido', async () => {
    const backupCode = 'abcd-1234';
    const hashed = await bcrypt.hash(backupCode, 4);
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET', mfaBackupCodes: [hashed] }));

    const result = await service.verifyMfaLogin('acc-1', backupCode);

    expect(result.ok).toBe(true);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { failedAttempts: 0, lockedUntil: null, mfaBackupCodes: [] },
    });
  });

  it('verifyMfaLogin rejeita token/código inválidos e conta como tentativa falha', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET', mfaBackupCodes: [] }));
    const result = await service.verifyMfaLogin('acc-1', '000000');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('resetMfa limpa o segredo, flag e códigos de backup', async () => {
    await service.resetMfa('acc-1');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });
  });
});
