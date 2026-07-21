import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const igField = (ig: number) => (ig === 1 ? 'ig1' : ig === 3 ? 'ig3' : 'ig2');

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.assessment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(data: { name: string; scopeIg?: number; createdBy?: string }) {
    return this.prisma.assessment.create({
      data: { name: data.name, scopeIg: data.scopeIg ?? 2, createdBy: data.createdBy },
    });
  }

  async getWithItems(id: string) {
    const a = await this.prisma.assessment.findUnique({
      where: { id },
      include: { items: { include: { evidences: true } } },
    });
    if (!a) throw new NotFoundException('Avaliação não encontrada');
    return a;
  }

  // Garante que o AssessmentItem exista (para anexar evidência sem alterar maturidade/na)
  ensureItem(assessmentId: string, safeguardId: string) {
    return this.prisma.assessmentItem.upsert({
      where: { assessmentId_safeguardId: { assessmentId, safeguardId } },
      update: {},
      create: { assessmentId, safeguardId },
    });
  }

  // Upsert da avaliação de uma salvaguarda
  async setItem(
    assessmentId: string,
    safeguardId: string,
    body: { maturity?: number | null; na?: boolean; evidenceText?: string; updatedBy?: string },
  ) {
    return this.prisma.assessmentItem.upsert({
      where: { assessmentId_safeguardId: { assessmentId, safeguardId } },
      update: {
        maturity: body.na ? null : body.maturity ?? null,
        na: !!body.na,
        evidenceText: body.evidenceText,
        updatedBy: body.updatedBy,
      },
      create: {
        assessmentId,
        safeguardId,
        maturity: body.na ? null : body.maturity ?? null,
        na: !!body.na,
        evidenceText: body.evidenceText,
        updatedBy: body.updatedBy,
      },
    });
  }

  /**
   * Resumo de maturidade no escopo IG informado.
   * Regra: não avaliado conta como 0; N/A fica fora do denominador.
   */
  async summary(id: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Avaliação não encontrada');
    const ig = igField(assessment.scopeIg);

    const controls = await this.prisma.control.findMany({
      orderBy: { number: 'asc' },
      include: { safeguards: { where: { [ig]: true } } },
    });
    const items = await this.prisma.assessmentItem.findMany({ where: { assessmentId: id } });
    const byId = new Map(items.map((i) => [i.safeguardId, i]));

    let gTotal = 0, gAppl = 0, gSum = 0, gAnswered = 0;
    const perControl = controls.map((c) => {
      let total = 0, applicable = 0, sum = 0, answered = 0;
      for (const s of c.safeguards) {
        total++;
        const it = byId.get(s.id);
        if (it?.na) continue;          // N/A fora do cálculo
        applicable++;
        if (it && typeof it.maturity === 'number') { answered++; sum += it.maturity; }
        // não avaliado soma 0
      }
      const avg = applicable ? sum / applicable : null;
      gTotal += total; gAppl += applicable; gSum += sum; gAnswered += answered;
      return {
        number: c.number, titlePt: c.titlePt,
        total, applicable, answered,
        avg, pct: avg == null ? null : Math.round((avg / 5) * 100),
      };
    });

    const gAvg = gAppl ? gSum / gAppl : null;
    return {
      scopeIg: assessment.scopeIg,
      total: gTotal, applicable: gAppl, answered: gAnswered,
      avg: gAvg, pct: gAvg == null ? null : Math.round((gAvg / 5) * 100),
      controls: perControl,
    };
  }
}
