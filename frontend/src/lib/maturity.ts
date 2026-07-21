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
