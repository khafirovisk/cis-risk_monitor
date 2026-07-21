// Severidade de risco: mesmos limiares do mockup (s = probabilidade * impacto).
export const sevKey = (s: number): 'crit' | 'high' | 'med' | 'low' =>
  s >= 17 ? 'crit' : s >= 10 ? 'high' : s >= 5 ? 'med' : 'low';

export const SEV_LABEL: Record<string, string> = { crit: 'Crítico', high: 'Alto', med: 'Médio', low: 'Baixo' };

export const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_TRATAMENTO: 'Em tratamento', MITIGADO: 'Mitigado', ACEITO: 'Aceito',
};
export const STATUS_OPTIONS = ['ABERTO', 'EM_TRATAMENTO', 'MITIGADO', 'ACEITO'] as const;
export const STATUS_PILL_CLASS: Record<string, string> = {
  ABERTO: 'p-crit', EM_TRATAMENTO: 'p-info', MITIGADO: 'p-low', ACEITO: 'p-neutral',
};

export const isActive = (status: string) => status === 'ABERTO' || status === 'EM_TRATAMENTO';

export function taskStats(tasks: { done: boolean; dueDate?: string | null }[]) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.dueDate && String(t.dueDate).slice(0, 10) < todayISO);
  return { total: tasks.length, done: tasks.length - open.length, overdue: overdue.length };
}
