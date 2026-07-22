import { LocalAccountsController } from './local-accounts.controller';

describe('LocalAccountsController', () => {
  it('list delega ao service', async () => {
    const svc: any = { list: jest.fn().mockResolvedValue([]) };
    const controller = new LocalAccountsController(svc);
    await controller.list();
    expect(svc.list).toHaveBeenCalled();
  });

  it('create delega ao service com o body recebido', async () => {
    const svc: any = { create: jest.fn().mockResolvedValue({ id: 'acc-2' }) };
    const controller = new LocalAccountsController(svc);
    const body = { username: 'novo', role: 'AUDITOR', password: 'senha1234' };

    await controller.create(body);

    expect(svc.create).toHaveBeenCalledWith(body);
  });
});
