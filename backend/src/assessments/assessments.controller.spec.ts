import { AssessmentsController } from './assessments.controller';

describe('AssessmentsController - uploadEvidences', () => {
  it('garante o item da avaliação e delega o upload ao EvidencesService', async () => {
    const svc = { ensureItem: jest.fn().mockResolvedValue({ id: 'item1' }) } as any;
    const evidences = { saveMany: jest.fn().mockResolvedValue([{ id: 'ev1' }]) } as any;
    const controller = new AssessmentsController(svc, evidences);
    const files = [{ originalname: 'a.txt', buffer: Buffer.from('x'), mimetype: 'text/plain', size: 1 }] as any;
    const req = { user: { email: 'auditor@empresa.com' } } as any;

    const result = await controller.uploadEvidences('assess1', '1.1', files, req);

    expect(svc.ensureItem).toHaveBeenCalledWith('assess1', '1.1');
    expect(evidences.saveMany).toHaveBeenCalledWith('item1', files, 'auditor@empresa.com');
    expect(result).toEqual([{ id: 'ev1' }]);
  });
});
