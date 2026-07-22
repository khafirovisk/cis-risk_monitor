import { BrandingService } from './branding.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
import * as fs from 'fs/promises';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    accentColor: null,
    logoStorageKey: null,
    logoFilename: null,
    logoMime: null,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BrandingService', () => {
  let prisma: any;
  let service: BrandingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      brandingSettings: {
        upsert: jest.fn().mockResolvedValue(makeRow()),
        findUnique: jest.fn().mockResolvedValue(makeRow()),
      },
    };
    service = new BrandingService(prisma);
  });

  it('cria a config default na primeira leitura e cacheia', async () => {
    const first = await service.getConfig();
    const second = await service.getConfig();
    expect(first).toEqual({ accentColor: null, hasLogo: false, updatedBy: null, updatedAt: expect.any(Date) });
    expect(prisma.brandingSettings.upsert).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('updateConfig persiste a cor e invalida o cache anterior', async () => {
    await service.getConfig();
    prisma.brandingSettings.upsert.mockResolvedValue(makeRow({ accentColor: '#123456', updatedBy: 'admin' }));

    const updated = await service.updateConfig({ accentColor: '#123456' }, 'admin');

    expect(updated.accentColor).toBe('#123456');
    expect(prisma.brandingSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { accentColor: '#123456', updatedBy: 'admin' },
      create: { id: 1, accentColor: '#123456', updatedBy: 'admin' },
    });
  });

  it('setLogo grava o arquivo em disco e atualiza hasLogo', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow());
    prisma.brandingSettings.upsert.mockResolvedValue(makeRow({ logoStorageKey: 'branding-logo-x-logo.png', logoMime: 'image/png' }));

    const file = { originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.from('fake') };
    const result = await service.setLogo(file, 'admin');

    expect(result.hasLogo).toBe(true);
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('branding-logo-'), file.buffer);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('setLogo remove o arquivo antigo quando já havia uma logo', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow({ logoStorageKey: 'branding-logo-old-old.png' }));
    prisma.brandingSettings.upsert.mockResolvedValue(makeRow({ logoStorageKey: 'branding-logo-new-new.png' }));

    const file = { originalname: 'new.png', mimetype: 'image/png', buffer: Buffer.from('fake') };
    await service.setLogo(file, 'admin');

    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('branding-logo-old-old.png'));
  });

  it('removeLogo apaga o arquivo do disco e zera os campos', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow({ logoStorageKey: 'branding-logo-x-logo.png' }));
    prisma.brandingSettings.upsert.mockResolvedValue(makeRow());

    const result = await service.removeLogo('admin');

    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('branding-logo-x-logo.png'));
    expect(prisma.brandingSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { logoStorageKey: null, logoFilename: null, logoMime: null, updatedBy: 'admin' },
      create: { id: 1, updatedBy: 'admin' },
    });
    expect(result.hasLogo).toBe(false);
  });

  it('removeLogo não tenta apagar arquivo quando não havia logo', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow());
    await service.removeLogo('admin');
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('getLogoFile retorna null quando não há logo configurada', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow());
    expect(await service.getLogoFile()).toBeNull();
  });

  it('getLogoFile retorna o caminho e mime quando há logo', async () => {
    prisma.brandingSettings.findUnique.mockResolvedValue(makeRow({ logoStorageKey: 'branding-logo-x-logo.png', logoMime: 'image/png' }));
    const result = await service.getLogoFile();
    expect(result).toEqual({ path: expect.stringContaining('branding-logo-x-logo.png'), mime: 'image/png' });
  });

  it('invalidateCache força nova leitura do banco', async () => {
    await service.getConfig();
    service.invalidateCache();
    await service.getConfig();
    expect(prisma.brandingSettings.upsert).toHaveBeenCalledTimes(2);
  });
});
