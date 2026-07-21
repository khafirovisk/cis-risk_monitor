import { api } from '../api/client';

// Garante uma avaliação "padrão" (para a PoC). Numa versão completa,
// haveria seleção/campanhas de avaliação por período.
let cache: any = null;
export async function ensureAssessment() {
  if (cache) return cache;
  const list = await api.assessments();
  cache = list[0] || (await api.createAssessment({ name: 'Avaliação padrão', scopeIg: 2 }));
  return cache;
}
