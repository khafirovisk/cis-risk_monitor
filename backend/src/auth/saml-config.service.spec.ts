import { SamlConfigService } from './saml-config.service';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    enabled: false,
    entryPoint: null,
    issuer: 'sentinela-cis',
    callbackUrl: null,
    idpCert: null,
    wantAssertionsSigned: true,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SamlConfigService', () => {
  let prisma: any;
  let service: SamlConfigService;

  beforeEach(() => {
    prisma = { samlConfig: { upsert: jest.fn() } };
    service = new SamlConfigService(prisma);
  });

  it('busca do banco na primeira chamada e cacheia depois', async () => {
    prisma.samlConfig.upsert.mockResolvedValue(makeRow());

    const first = await service.getConfig();
    const second = await service.getConfig();

    expect(first.issuer).toBe('sentinela-cis');
    expect(second).toBe(first);
    expect(prisma.samlConfig.upsert).toHaveBeenCalledTimes(1);
  });

  it('updateConfig persiste e invalida o cache', async () => {
    prisma.samlConfig.upsert.mockResolvedValueOnce(makeRow());
    await service.getConfig();

    prisma.samlConfig.upsert.mockResolvedValueOnce(
      makeRow({ enabled: true, entryPoint: 'https://idp.example.com/sso' }),
    );
    const updated = await service.updateConfig(
      {
        enabled: true,
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'sentinela-cis',
        callbackUrl: null,
        idpCert: null,
        wantAssertionsSigned: true,
      },
      'admin@empresa.com',
    );

    expect(updated.enabled).toBe(true);
    expect(updated.entryPoint).toBe('https://idp.example.com/sso');

    const cached = await service.getConfig();
    expect(cached).toBe(updated);
    expect(prisma.samlConfig.upsert).toHaveBeenCalledTimes(2);
  });
});
