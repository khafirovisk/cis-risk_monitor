import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('GET retorna a lista de usuarios do service', async () => {
    const users = [
      { id: '1', email: 'admin@empresa.com', name: 'Admin', role: 'ADMIN', createdAt: new Date() },
    ];
    const svc = { list: jest.fn().mockResolvedValue(users) } as any;
    const controller = new UsersController(svc);

    const result = await controller.list();

    expect(result).toEqual(users);
    expect(svc.list).toHaveBeenCalled();
  });
});
