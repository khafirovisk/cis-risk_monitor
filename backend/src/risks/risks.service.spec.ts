import { RisksService } from './risks.service';

function makeExisting(overrides: Partial<any> = {}) {
  return { id: 'risk-1', title: 'Título original', description: 'Descrição original', ...overrides };
}

describe('RisksService', () => {
  let prisma: any;
  let aiClassifier: any;
  let service: RisksService;

  beforeEach(() => {
    prisma = {
      control: { findMany: jest.fn().mockResolvedValue([{ id: 'ctrl-1', number: 1 }, { id: 'ctrl-3', number: 3 }]) },
      risk: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(makeExisting()),
        create: jest.fn().mockResolvedValue({ id: 'risk-1' }),
        update: jest.fn().mockResolvedValue({ id: 'risk-1' }),
      },
      riskControl: { deleteMany: jest.fn() },
      task: { deleteMany: jest.fn() },
    };
    aiClassifier = { classifyControls: jest.fn() };
    service = new RisksService(prisma, aiClassifier);
  });

  describe('create', () => {
    it('usa a classificação da IA para vincular os controles e anexa aiWarning null em caso de sucesso', async () => {
      aiClassifier.classifyControls.mockResolvedValue({ controlNumbers: [1, 3], error: null });

      const result = await service.create({ title: 'Ransomware', description: 'desc' });

      expect(aiClassifier.classifyControls).toHaveBeenCalledWith('Ransomware', 'desc');
      expect(prisma.control.findMany).toHaveBeenCalledWith({ where: { number: { in: [1, 3] } } });
      expect(prisma.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            controls: { create: [{ controlId: 'ctrl-1' }, { controlId: 'ctrl-3' }] },
          }),
        }),
      );
      expect(result.aiWarning).toBeNull();
    });

    it('cria o risco sem controles e anexa o aviso quando a IA falha', async () => {
      aiClassifier.classifyControls.mockResolvedValue({ controlNumbers: [], error: 'a IA não está configurada' });

      const result = await service.create({ title: 'Ransomware', description: 'desc' });

      expect(prisma.control.findMany).not.toHaveBeenCalled();
      expect(prisma.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ controls: { create: [] } }) }),
      );
      expect(result.aiWarning).toBe('a IA não está configurada');
    });
  });

  describe('update', () => {
    it('não chama a IA e respeita os controlNumbers enviados quando título/descrição não mudaram', async () => {
      prisma.risk.findUniqueOrThrow.mockResolvedValue(makeExisting());

      const result = await service.update('risk-1', {
        title: 'Título original',
        description: 'Descrição original',
        controlNumbers: [3],
      });

      expect(aiClassifier.classifyControls).not.toHaveBeenCalled();
      expect(prisma.control.findMany).toHaveBeenCalledWith({ where: { number: { in: [3] } } });
      expect(result.aiWarning).toBeNull();
    });

    it('chama a IA de novo e substitui os controles quando o título mudou', async () => {
      prisma.risk.findUniqueOrThrow.mockResolvedValue(makeExisting());
      aiClassifier.classifyControls.mockResolvedValue({ controlNumbers: [1], error: null });

      const result = await service.update('risk-1', {
        title: 'Título mudou',
        description: 'Descrição original',
        controlNumbers: [3], // correção manual que deve ser sobrescrita
      });

      expect(aiClassifier.classifyControls).toHaveBeenCalledWith('Título mudou', 'Descrição original');
      expect(prisma.control.findMany).toHaveBeenCalledWith({ where: { number: { in: [1] } } });
      expect(result.aiWarning).toBeNull();
    });

    it('chama a IA de novo quando só a descrição mudou', async () => {
      prisma.risk.findUniqueOrThrow.mockResolvedValue(makeExisting());
      aiClassifier.classifyControls.mockResolvedValue({ controlNumbers: [], error: 'falha na chamada' });

      const result = await service.update('risk-1', {
        title: 'Título original',
        description: 'Descrição mudou',
        controlNumbers: [1, 3],
      });

      expect(aiClassifier.classifyControls).toHaveBeenCalledWith('Título original', 'Descrição mudou');
      expect(prisma.control.findMany).not.toHaveBeenCalled();
      expect(result.aiWarning).toBe('falha na chamada');
    });
  });
});
