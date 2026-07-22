import { BrandingController } from './branding.controller';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function makeRes() {
  return { setHeader: jest.fn(), sendFile: jest.fn() };
}

describe('BrandingController', () => {
  it('get delega ao service', async () => {
    const svc: any = { getConfig: jest.fn().mockResolvedValue({ accentColor: null, hasLogo: false }) };
    const controller = new BrandingController(svc);
    expect(await controller.get()).toEqual({ accentColor: null, hasLogo: false });
  });

  it('logo lança NotFoundException quando não há logo configurada', async () => {
    const svc: any = { getLogoFile: jest.fn().mockResolvedValue(null) };
    const controller = new BrandingController(svc);
    await expect(controller.logo(makeRes() as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('logo envia o arquivo com o Content-Type correto quando existe', async () => {
    const svc: any = { getLogoFile: jest.fn().mockResolvedValue({ path: '/uploads/branding-logo-x.png', mime: 'image/png' }) };
    const controller = new BrandingController(svc);
    const res = makeRes();

    await controller.logo(res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.sendFile).toHaveBeenCalledWith('/uploads/branding-logo-x.png');
  });

  it('update usa o email da sessão como updatedBy quando presente', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new BrandingController(svc);
    const req: any = { user: { email: 'ana@empresa.com' } };

    await controller.update({ accentColor: '#123456' }, req);

    expect(svc.updateConfig).toHaveBeenCalledWith({ accentColor: '#123456' }, 'ana@empresa.com');
  });

  it('uploadLogo rejeita quando não vem arquivo', async () => {
    const svc: any = { setLogo: jest.fn() };
    const controller = new BrandingController(svc);
    const req: any = { user: { username: 'admin' } };

    expect(() => controller.uploadLogo(undefined as any, req)).toThrow(BadRequestException);
    expect(svc.setLogo).not.toHaveBeenCalled();
  });

  it('uploadLogo rejeita formato fora da whitelist', async () => {
    const svc: any = { setLogo: jest.fn() };
    const controller = new BrandingController(svc);
    const req: any = { user: { username: 'admin' } };
    const file: any = { originalname: 'logo.svg', mimetype: 'image/svg+xml', buffer: Buffer.from('x') };

    expect(() => controller.uploadLogo(file, req)).toThrow(BadRequestException);
    expect(svc.setLogo).not.toHaveBeenCalled();
  });

  it('uploadLogo delega ao service quando o arquivo é válido', () => {
    const svc: any = { setLogo: jest.fn().mockResolvedValue({ hasLogo: true }) };
    const controller = new BrandingController(svc);
    const req: any = { user: { username: 'admin' } };
    const file: any = { originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.from('x') };

    controller.uploadLogo(file, req);

    expect(svc.setLogo).toHaveBeenCalledWith(file, 'admin');
  });

  it('removeLogo delega ao service com o autor da sessão', async () => {
    const svc: any = { removeLogo: jest.fn().mockResolvedValue({ hasLogo: false }) };
    const controller = new BrandingController(svc);
    const req: any = { user: { email: 'ana@empresa.com' } };

    await controller.removeLogo(req);

    expect(svc.removeLogo).toHaveBeenCalledWith('ana@empresa.com');
  });
});
