import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Gauge } from '../components/Gauge';
import { LEVEL_COLOR } from '../lib/maturity';
import { ensureAssessment } from './useAssessment';

export function Dashboard() {
  const [sum, setSum] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      setSum(await api.summary(a.id));
    })().catch(console.error);
  }, []);

  if (!sum) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <h1 className="page-title">Visão geral — maturidade CIS</h1>
      <p className="page-sub">
        Índice de maturidade no escopo IG{sum.scopeIg}. Salvaguardas não avaliadas contam como 0.
      </p>

      <div className="card" style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Gauge pct={sum.pct} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="mono" style={{ color: 'var(--ink-2)' }}>
            média <b style={{ color: 'var(--ink)' }}>{sum.avg != null ? sum.avg.toFixed(1) : '—'}</b> / 5 · <b>{sum.pct ?? '—'}%</b>
          </div>
          <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>
            {sum.answered}/{sum.total} salvaguardas avaliadas ({sum.applicable} aplicáveis)
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <b>Maturidade por controle</b>
        <div style={{ marginTop: 10 }}>
          {sum.controls.map((c: any) => (
            <div key={c.number} style={{ display: 'grid', gridTemplateColumns: '230px 1fr 70px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
              <span style={{ color: 'var(--ink-2)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(c.number).padStart(2, '0')} · {c.titlePt}
              </span>
              <span className="progress">
                <i style={{ width: `${c.pct ?? 0}%`, background: LEVEL_COLOR(c.avg == null ? null : Math.round(c.avg)) }} />
              </span>
              <span className="mono" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{c.pct != null ? c.pct + '%' : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
