import { AiSettingsService } from './ai-settings.service';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    enabled: false,
    baseUrl: null,
    apiKey: null,
    model: null,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AiSettingsService', () => {
  let prisma: any;
  let service: AiSettingsService;

  beforeEach(() => {
    prisma = {
      aiSettings: {
        upsert: jest.fn().mockResolvedValue(makeRow()),
        findUnique: jest.fn().mockResolvedValue(makeRow()),
      },
    };
    service = new AiSettingsService(prisma);
  });

  it('cria a config default na primeira leitura e cacheia', async () => {
    const first = await service.getConfig();
    const second = await service.getConfig();
    expect(first).toEqual({ enabled: false, baseUrl: null, model: null, hasApiKey: false, updatedBy: null, updatedAt: expect.any(Date) });
    expect(prisma.aiSettings.upsert).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('getConfig nunca expõe o valor da apiKey, só hasApiKey', async () => {
    prisma.aiSettings.upsert.mockResolvedValue(makeRow({ apiKey: 'sk-super-secreta' }));
    const config = await service.getConfig();
    expect(config).not.toHaveProperty('apiKey');
    expect(config.hasApiKey).toBe(true);
  });

  it('updateConfig sobrescreve a apiKey quando um valor novo é enviado', async () => {
    prisma.aiSettings.upsert.mockResolvedValue(makeRow({ enabled: true, apiKey: 'sk-nova' }));

    await service.updateConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', apiKey: 'sk-nova' }, 'admin');

    expect(prisma.aiSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: expect.objectContaining({ apiKey: 'sk-nova' }),
      create: expect.objectContaining({ apiKey: 'sk-nova' }),
    });
  });

  it('updateConfig mantém a apiKey atual quando nenhum valor novo é enviado', async () => {
    prisma.aiSettings.upsert.mockResolvedValue(makeRow({ enabled: true }));

    await service.updateConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' }, 'admin');

    const call = prisma.aiSettings.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('apiKey');
    expect(call.create).not.toHaveProperty('apiKey');
  });

  it('getApiKey retorna o valor bruto armazenado', async () => {
    prisma.aiSettings.findUnique.mockResolvedValue(makeRow({ apiKey: 'sk-real' }));
    expect(await service.getApiKey()).toBe('sk-real');
  });

  it('getApiKey retorna null quando não há linha configurada', async () => {
    prisma.aiSettings.findUnique.mockResolvedValue(null);
    expect(await service.getApiKey()).toBeNull();
  });

  it('invalidateCache força nova leitura do banco', async () => {
    await service.getConfig();
    service.invalidateCache();
    await service.getConfig();
    expect(prisma.aiSettings.upsert).toHaveBeenCalledTimes(2);
  });
});
