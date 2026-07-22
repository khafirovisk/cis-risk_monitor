import { SecurityController } from './security-settings.controller';

describe('SecurityController', () => {
  it('get delega ao service', () => {
    const svc: any = { getConfig: jest.fn().mockResolvedValue({ passwordMinLength: 8 }) };
    const controller = new SecurityController(svc);
    expect(controller.get()).resolves.toEqual({ passwordMinLength: 8 });
    expect(svc.getConfig).toHaveBeenCalled();
  });

  it('update usa o email da sessão como updatedBy quando presente', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new SecurityController(svc);
    const body: any = { passwordMinLength: 10, passwordRequireUppercase: true, passwordRequireNumber: false, passwordRequireSymbol: false, mfaRequired: true };
    const req: any = { user: { email: 'ana@empresa.com' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'ana@empresa.com');
  });

  it('update usa o username quando não há email (conta local)', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new SecurityController(svc);
    const body: any = { passwordMinLength: 8, passwordRequireUppercase: false, passwordRequireNumber: false, passwordRequireSymbol: false, mfaRequired: false };
    const req: any = { user: { username: 'admin' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'admin');
  });
});
