import { NotFoundException } from '@nestjs/common';
import { EvidencesController } from './evidences.controller';

describe('EvidencesController', () => {
  it('download: lança 404 quando a evidência não existe', async () => {
    const svc = { findOne: jest.fn().mockResolvedValue(null) } as any;
    const controller = new EvidencesController(svc);
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as any;

    await expect(controller.download('nope', res)).rejects.toThrow(NotFoundException);
  });

  it('download: envia o arquivo com os headers certos', async () => {
    const evidence = { id: 'ev1', filename: 'foto.png', mime: 'image/png', storageKey: 'abc-foto.png' };
    const svc = {
      findOne: jest.fn().mockResolvedValue(evidence),
      filePath: jest.fn().mockReturnValue('/app/uploads/abc-foto.png'),
    } as any;
    const controller = new EvidencesController(svc);
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as any;

    await controller.download('ev1', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.sendFile).toHaveBeenCalledWith('/app/uploads/abc-foto.png');
  });

  it('remove: apaga a evidência existente', async () => {
    const evidence = { id: 'ev1', storageKey: 'abc-foto.png' };
    const svc = { findOne: jest.fn().mockResolvedValue(evidence), remove: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new EvidencesController(svc);

    const result = await controller.remove('ev1');

    expect(svc.remove).toHaveBeenCalledWith(evidence);
    expect(result).toEqual({ ok: true });
  });

  it('remove: lança 404 quando a evidência não existe', async () => {
    const svc = { findOne: jest.fn().mockResolvedValue(null) } as any;
    const controller = new EvidencesController(svc);
    await expect(controller.remove('nope')).rejects.toThrow(NotFoundException);
  });
});
