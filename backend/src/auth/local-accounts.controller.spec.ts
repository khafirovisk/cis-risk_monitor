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

  it('create rejeita quando password está ausente, sem chamar o service', () => {
    const svc: any = { create: jest.fn() };
    const controller = new LocalAccountsController(svc);
    const body: any = { username: 'novo', role: 'AUDITOR' };

    expect(() => controller.create(body)).toThrow('Senha é obrigatória');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('create rejeita quando role é inválido, sem chamar o service', () => {
    const svc: any = { create: jest.fn() };
    const controller = new LocalAccountsController(svc);
    const body: any = { username: 'novo', role: 'SUPERUSER', password: 'senha1234' };

    expect(() => controller.create(body)).toThrow('Papel inválido');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('resetMfa delega ao service com o id da rota e retorna ok', async () => {
    const svc: any = { resetMfa: jest.fn().mockResolvedValue(undefined) };
    const controller = new LocalAccountsController(svc);

    const result = await controller.resetMfa('acc-1');

    expect(svc.resetMfa).toHaveBeenCalledWith('acc-1');
    expect(result).toEqual({ ok: true });
  });
});
