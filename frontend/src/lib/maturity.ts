// Mesmas regras da demo: nível 0..5 -> cor; % = média/5*100.
export const LEVEL_COLOR = (v: number | null): string =>
  v == null ? 'var(--surface-2)'
    : v <= 1 ? 'var(--crit)'
    : v === 2 ? 'var(--high)'
    : v === 3 ? 'var(--med)'
    : 'var(--low)';

export const matPct = (avg: number | null): number | null =>
  avg == null ? null : Math.round((avg / 5) * 100);

export const GAUGE_BANDS = [
  { c: 'var(--crit)', lo: 0, hi: 20, lbl: 'Inexistente / inicial' },
  { c: 'var(--high)', lo: 20, hi: 40, lbl: 'Documentado (nível 2)' },
  { c: 'var(--med)', lo: 40, hi: 60, lbl: 'Implementado (nível 3)' },
  { c: 'var(--low)', lo: 60, hi: 80, lbl: 'Gerenciado (nível 4)' },
  { c: 'var(--accent)', lo: 80, hi: 100, lbl: 'Otimizado (nível 5)' },
];

// Escopo IG selecionável em tempo de exibição (Dashboard/Auditoria) — não
// altera o que já foi respondido, só o que entra no cálculo/visão atual.
export const igField = (scopeIg: number): 'ig1' | 'ig2' | 'ig3' =>
  scopeIg === 1 ? 'ig1' : scopeIg === 3 ? 'ig3' : 'ig2';

export function scopedSafeguards(control: any, scopeIg: number) {
  const ig = igField(scopeIg);
  return control.safeguards.filter((s: any) => s[ig]);
}

// Mesma regra do backend (AssessmentsService.summary): não avaliado soma 0,
// N/A fica fora do denominador.
export function ctrlStats(control: any, itemsById: Record<string, any>, scopeIg: number) {
  const sgs = scopedSafeguards(control, scopeIg);
  let answered = 0, applicable = 0, sum = 0;
  sgs.forEach((s: any) => {
    const it = itemsById[s.id];
    if (it?.na) return;
    applicable++;
    if (it && typeof it.maturity === 'number') { answered++; sum += it.maturity; }
  });
  return { total: sgs.length, answered, applicable, avg: applicable ? sum / applicable : null };
}

export function assessmentStats(controls: any[], itemsById: Record<string, any>, scopeIg: number) {
  const ig = igField(scopeIg);
  let total = 0, answered = 0, applicable = 0, sum = 0;
  controls.forEach((c) => {
    c.safeguards.filter((s: any) => s[ig]).forEach((s: any) => {
      total++;
      const it = itemsById[s.id];
      if (it?.na) return;
      applicable++;
      if (it && typeof it.maturity === 'number') { answered++; sum += it.maturity; }
    });
  });
  const avg = applicable ? sum / applicable : null;
  return { total, answered, applicable, avg, pct: matPct(avg) };
}

export function levelLabel(m: number | null | undefined, na: boolean): { cls: string; label: string } {
  if (na) return { cls: 'p-neutral', label: 'N/A' };
  if (m == null) return { cls: 'p-neutral', label: 'Não avaliado' };
  const cls = m <= 1 ? 'p-crit' : m === 2 ? 'p-high' : m === 3 ? 'p-med' : 'p-low';
  return { cls, label: `Nível ${m}` };
}
