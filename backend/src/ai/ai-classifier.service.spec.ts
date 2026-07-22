import { AiClassifierService } from './ai-classifier.service';

const CONTROLS = [
  { number: 1, titlePt: 'Inventário e Controle de Ativos Corporativos' },
  { number: 3, titlePt: 'Proteção de Dados' },
  { number: 5, titlePt: 'Gestão de Contas' },
];

function makeConfig(overrides: Partial<any> = {}) {
  return {
    enabled: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    hasApiKey: true,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockFetchResponse(ok: boolean, body: any) {
  return { ok, status: ok ? 200 : 500, json: jest.fn().mockResolvedValue(body) };
}

describe('AiClassifierService', () => {
  let prisma: any;
  let settings: any;
  let service: AiClassifierService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = { control: { findMany: jest.fn().mockResolvedValue(CONTROLS) } };
    settings = { getConfig: jest.fn().mockResolvedValue(makeConfig()), getApiKey: jest.fn().mockResolvedValue('sk-test') };
    service = new AiClassifierService(prisma, settings);
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retorna erro sem chamar a IA quando não está habilitada', async () => {
    settings.getConfig.mockResolvedValue(makeConfig({ enabled: false }));
    const result = await service.classifyControls('Ransomware', 'desc');
    expect(result.controlNumbers).toEqual([]);
    expect(result.error).toMatch(/não está configurada/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retorna erro sem chamar a IA quando falta apiKey/baseUrl/model', async () => {
    settings.getConfig.mockResolvedValue(makeConfig({ hasApiKey: false }));
    const result = await service.classifyControls('Ransomware', 'desc');
    expect(result.error).toMatch(/não está configurada/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('classifica com sucesso e filtra só números de controle válidos', async () => {
    fetchSpy.mockResolvedValue(
      mockFetchResponse(true, { choices: [{ message: { content: '{"controls": [1, 3, 99]}' } }] }),
    );

    const result = await service.classifyControls('Ransomware nos servidores', 'descrição do risco');

    expect(result.error).toBeNull();
    expect(result.controlNumbers.sort()).toEqual([1, 3]); // 99 não é um controle válido, foi descartado
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('extrai o JSON mesmo quando a IA responde com texto ao redor', async () => {
    fetchSpy.mockResolvedValue(
      mockFetchResponse(true, { choices: [{ message: { content: 'Aqui está: {"controls": [5]} espero que ajude!' } }] }),
    );
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers).toEqual([5]);
  });

  it('deduplica números repetidos', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse(true, { choices: [{ message: { content: '{"controls": [1, 1, 3]}' } }] }));
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers.sort()).toEqual([1, 3]);
  });

  it('retorna erro quando a chamada HTTP falha (status não-2xx)', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse(false, {}));
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers).toEqual([]);
    expect(result.error).toMatch(/falha na chamada/);
  });

  it('retorna erro quando o fetch lança uma exceção (ex.: rede)', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers).toEqual([]);
    expect(result.error).toMatch(/falha na chamada/);
  });

  it('retorna erro quando o conteúdo da resposta não é um JSON válido', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse(true, { choices: [{ message: { content: 'não sei responder isso' } }] }));
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers).toEqual([]);
    expect(result.error).toMatch(/não pôde ser interpretada/);
  });

  it('retorna erro quando o JSON é válido mas não contém nenhum controle reconhecível', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse(true, { choices: [{ message: { content: '{"controls": [999]}' } }] }));
    const result = await service.classifyControls('Risco', 'desc');
    expect(result.controlNumbers).toEqual([]);
    expect(result.error).toMatch(/não pôde ser interpretada/);
  });
});
