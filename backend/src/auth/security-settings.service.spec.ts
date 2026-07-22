import { SecuritySettingsService } from './security-settings.service';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireNumber: false,
    passwordRequireSymbol: false,
    mfaRequired: false,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SecuritySettingsService', () => {
  let prisma: any;
  let service: SecuritySettingsService;

  beforeEach(() => {
    prisma = { securitySettings: { upsert: jest.fn().mockResolvedValue(makeRow()) } };
    service = new SecuritySettingsService(prisma);
  });

  it('cria a config default na primeira leitura e cacheia', async () => {
    const first = await service.getConfig();
    const second = await service.getConfig();
    expect(first.passwordMinLength).toBe(8);
    expect(prisma.securitySettings.upsert).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('updateConfig persiste e invalida o cache anterior', async () => {
    await service.getConfig();
    prisma.securitySettings.upsert.mockResolvedValue(makeRow({ mfaRequired: true, updatedBy: 'admin' }));

    const updated = await service.updateConfig(
      {
        passwordMinLength: 10,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSymbol: false,
        mfaRequired: true,
      },
      'admin',
    );

    expect(updated.mfaRequired).toBe(true);
    expect(prisma.securitySettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: expect.objectContaining({ mfaRequired: true, updatedBy: 'admin' }),
      create: expect.objectContaining({ id: 1, mfaRequired: true, updatedBy: 'admin' }),
    });
  });

  it('invalidateCache força nova leitura do banco', async () => {
    await service.getConfig();
    service.invalidateCache();
    await service.getConfig();
    expect(prisma.securitySettings.upsert).toHaveBeenCalledTimes(2);
  });
});
