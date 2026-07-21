import { useEffect, useState } from 'react';
import { api } from '../api/client';

const sevKey = (s: number) => (s >= 17 ? 'crit' : s >= 10 ? 'high' : s >= 5 ? 'med' : 'low');
const SEV = { crit: 'Crítico', high: 'Alto', med: 'Médio', low: 'Baixo' } as const;
const sevColor = (k: string) => `var(--${k})`;

export function Riscos() {
  const [risks, setRisks] = useState<any[]>([]);

  async function load() { setRisks(await api.risks()); }
  useEffect(() => { load().catch(console.error); }, []);

  async function novo() {
    const title = prompt('Título do risco:');
    if (!title) return;
    await api.createRisk({ title, probInherent: 3, impactInherent: 3, probResidual: 3, impactResidual: 3 });
    await load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Registro de riscos</h1>
          <p className="page-sub">Riscos mapeados com severidade inerente e residual e vínculo aos controles CIS.</p>
        </div>
        <button className="btn" onClick={novo}>+ Novo risco</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Risco</th><th>Inerente</th><th>Residual</th><th>Responsável</th><th>Status</th><th>Controles</th></tr></thead>
          <tbody>
            {risks.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--ink-3)' }}>Nenhum risco cadastrado.</td></tr>}
            {risks.map((r) => {
              const si = r.probInherent * r.impactInherent;
              const sr = r.probResidual * r.impactResidual;
              const pill = (s: number) => {
                const k = sevKey(s);
                return <span className="pill" style={{ background: sevColor(k) + '22', color: sevColor(k) }}>{SEV[k as keyof typeof SEV]} ({s})</span>;
              };
              return (
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td>{pill(si)}</td>
                  <td>{pill(sr)}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{r.ownerName || '—'}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{r.status}</td>
                  <td>{(r.controls || []).map((c: any) => c.control?.number).filter(Boolean).map((n: number) => `C${String(n).padStart(2, '0')}`).join(' ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
