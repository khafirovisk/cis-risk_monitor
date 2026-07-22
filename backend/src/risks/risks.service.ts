import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiClassifierService } from '../ai/ai-classifier.service';

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
  constructor(
    private prisma: PrismaService,
    private aiClassifier: AiClassifierService,
  ) {}

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

  // Cria o risco sem checkbox manual de controles: a IA decide quais controles
  // CIS estão associados. Se ela falhar ou não estiver configurada, o risco é
  // criado do mesmo jeito, sem controles, e o motivo vai em `aiWarning`.
  async create(data: RiskIn) {
    const classification = await this.aiClassifier.classifyControls(data.title, data.description);
    const controlIds = await this.controlIdsFromNumbers(classification.controlNumbers);
    const risk = await this.prisma.risk.create({
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
    return { ...risk, aiWarning: classification.error };
  }

  // Edição continua com o checkbox manual (controlNumbers vindo do body é
  // respeitado). MAS se título ou descrição mudaram, a IA roda de novo e
  // substitui os controles pela nova classificação (mesmo que por cima de uma
  // correção manual feita na mesma edição) — o risco em si mudou o bastante
  // pra justificar reclassificar.
  async update(id: string, data: RiskIn) {
    const existing = await this.prisma.risk.findUniqueOrThrow({ where: { id } });
    const contentChanged =
      existing.title !== data.title || (existing.description ?? '') !== (data.description ?? '');

    let controlNumbers = data.controlNumbers ?? [];
    let aiWarning: string | null = null;
    if (contentChanged) {
      const classification = await this.aiClassifier.classifyControls(data.title, data.description);
      controlNumbers = classification.controlNumbers;
      aiWarning = classification.error;
    }

    const controlIds = await this.controlIdsFromNumbers(controlNumbers);
    // substitui vínculos e tarefas (simples e previsível para a demo/PoC)
    await this.prisma.riskControl.deleteMany({ where: { riskId: id } });
    await this.prisma.task.deleteMany({ where: { riskId: id } });
    const risk = await this.prisma.risk.update({
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
    return { ...risk, aiWarning };
  }

  remove(id: string) {
    return this.prisma.risk.delete({ where: { id } });
  }
}
