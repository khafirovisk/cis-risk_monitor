import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TaskIn = { description: string; assignee?: string; dueDate?: string; done?: boolean };
type RiskIn = {
  title: string; description?: string;
  probInherent?: number; impactInherent?: number;
  probResidual?: number; impactResidual?: number;
  ownerName?: string; status?: any;
  controlNumbers?: number[]; tasks?: TaskIn[];
};

@Injectable()
export class RisksService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.risk.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tasks: true, controls: { include: { control: true } } },
    });
  }

  private async controlIdsFromNumbers(numbers: number[] = []) {
    if (!numbers.length) return [];
    const ctrls = await this.prisma.control.findMany({ where: { number: { in: numbers } } });
    return ctrls.map((c) => c.id);
  }

  async create(data: RiskIn) {
    const controlIds = await this.controlIdsFromNumbers(data.controlNumbers);
    return this.prisma.risk.create({
      data: {
        title: data.title, description: data.description,
        probInherent: data.probInherent ?? 3, impactInherent: data.impactInherent ?? 3,
        probResidual: data.probResidual ?? 3, impactResidual: data.impactResidual ?? 3,
        ownerName: data.ownerName, status: data.status ?? 'ABERTO',
        controls: { create: controlIds.map((controlId) => ({ controlId })) },
        tasks: {
          create: (data.tasks ?? []).map((t) => ({
            description: t.description, assignee: t.assignee,
            dueDate: t.dueDate ? new Date(t.dueDate) : null, done: !!t.done,
          })),
        },
      },
      include: { tasks: true, controls: true },
    });
  }

  async update(id: string, data: RiskIn) {
    const controlIds = await this.controlIdsFromNumbers(data.controlNumbers);
    // substitui vínculos e tarefas (simples e previsível para a demo/PoC)
    await this.prisma.riskControl.deleteMany({ where: { riskId: id } });
    await this.prisma.task.deleteMany({ where: { riskId: id } });
    return this.prisma.risk.update({
      where: { id },
      data: {
        title: data.title, description: data.description,
        probInherent: data.probInherent, impactInherent: data.impactInherent,
        probResidual: data.probResidual, impactResidual: data.impactResidual,
        ownerName: data.ownerName, status: data.status,
        controls: { create: controlIds.map((controlId) => ({ controlId })) },
        tasks: {
          create: (data.tasks ?? []).map((t) => ({
            description: t.description, assignee: t.assignee,
            dueDate: t.dueDate ? new Date(t.dueDate) : null, done: !!t.done,
          })),
        },
      },
      include: { tasks: true, controls: true },
    });
  }

  remove(id: string) {
    return this.prisma.risk.delete({ where: { id } });
  }
}
