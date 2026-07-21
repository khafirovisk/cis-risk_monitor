import { isActive, taskStats } from './risk';

export type InsightItem = { sev: 'crit' | 'high' | 'med'; text: string; view: 'auditoria' | 'riscos' };

// Porta as 5 regras do mockup para os dados reais (controles com salvaguardas,
// items da avaliação por safeguardId, e riscos com tasks/controls).
export function computeInsights(controls: any[], itemsById: Record<string, any>, risks: any[]): InsightItem[] {
  const items: InsightItem[] = [];

  let semEvidencia = 0;
  controls.forEach((c) => c.safeguards.forEach((s: any) => {
    const it = itemsById[s.id];
    const evCount = (it?.evidenceText?.trim() ? 1 : 0) + (it?.evidences?.length || 0);
    if (it && typeof it.maturity === 'number' && it.maturity >= 3 && !evCount) semEvidencia++;
  }));
  if (semEvidencia) {
    items.push({ sev: 'high', text: `${semEvidencia} salvaguarda(s) com nível ≥ 3 declarado sem nenhuma evidência registrada`, view: 'auditoria' });
  }

  let antigas = 0;
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  controls.forEach((c) => c.safeguards.forEach((s: any) => {
    const it = itemsById[s.id];
    if (it?.updatedAt && new Date(it.updatedAt) < umAnoAtras) antigas++;
  }));
  if (antigas) {
    items.push({ sev: 'med', text: `${antigas} salvaguarda(s) avaliada(s) há mais de 12 meses — reavalie`, view: 'auditoria' });
  }

  const ativos = risks.filter((r) => isActive(r.status));

  const semTarefa = ativos.filter((r) => r.probResidual * r.impactResidual >= 10 && !(r.tasks || []).length).length;
  if (semTarefa) {
    items.push({ sev: 'crit', text: `${semTarefa} risco(s) alto/crítico sem nenhuma tarefa de tratamento`, view: 'riscos' });
  }

  const semControle = ativos.filter((r) => !(r.controls || []).length).length;
  if (semControle) {
    items.push({ sev: 'med', text: `${semControle} risco(s) ativo(s) sem controle CIS vinculado — o crosswalk fica cego`, view: 'riscos' });
  }

  let atrasadas = 0;
  risks.forEach((r) => { atrasadas += taskStats(r.tasks || []).overdue; });
  if (atrasadas) {
    items.push({ sev: 'high', text: `${atrasadas} tarefa(s) de tratamento de risco com prazo vencido`, view: 'riscos' });
  }

  const order = { crit: 0, high: 1, med: 2 };
  return items.sort((a, b) => order[a.sev] - order[b.sev]);
}
