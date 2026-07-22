import { UsersService } from './users.service';

describe('UsersService', () => {
  it('lista usuarios ordenados por criacao (mais recente primeiro), selecionando so os campos publicos', async () => {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new UsersService(prisma as any);

    await service.list();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  });
});
