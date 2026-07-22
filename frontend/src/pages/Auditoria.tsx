import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LEVEL_COLOR } from '../lib/maturity';
import { ensureAssessment } from './useAssessment';
import { SafeguardAccordion } from '../components/SafeguardAccordion';

export function Auditoria() {
  const [assessmentId, setId] = useState<string>('');
  const [controls, setControls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const [items, setItems] = useState<Record<string, any>>({});

  async function reload(id: string) {
    setSummary(await api.summary(id));
    const a = await api.assessment(id);
    const map: Record<string, any> = {};
    a.items.forEach((it: any) => (map[it.safeguardId] = it));
    setItems(map);
  }

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      setId(a.id);
      setControls(await api.controls());
      await reload(a.id);
    })().catch(console.error);
  }, []);

  const pctOf = (n: number) => summary?.controls.find((c: any) => c.number === n)?.pct ?? null;

  if (!controls.length) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <h1 className="page-title">Auditoria — CIS Controls v8.1.2</h1>
      <p className="page-sub">
        Maturidade geral: <b>{summary?.pct ?? '—'}%</b> · média {summary?.avg != null ? summary.avg.toFixed(1) : '—'}/5
        {' '}· {summary?.answered}/{summary?.total} avaliadas (IG{summary?.scopeIg}).
      </p>

      {!open ? (
        <div className="grid ctrl-grid">
          {controls.map((c) => {
            const pct = pctOf(c.number);
            const col = LEVEL_COLOR(pct == null ? null : Math.round((pct / 100) * 5));
            return (
              <div className="card ctrl-card" key={c.number} onClick={() => setOpen(c)}>
                <span className="ctrl-num">CONTROLE {String(c.number).padStart(2, '0')}</span>
                <span className="ctrl-name">{c.titlePt}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="ctrl-pct" style={{ color: pct != null ? col : 'var(--ink-3)' }}>{pct != null ? pct + '%' : '—'}</span>
                  <span className="progress" style={{ flex: 1 }}><i style={{ width: `${pct ?? 0}%`, background: col }} /></span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <button className="back-btn" onClick={() => setOpen(null)}>← Voltar à auditoria</button>
          <h2 className="page-title" style={{ fontSize: 18 }}>{String(open.number).padStart(2, '0')} · {open.titlePt}</h2>
          <p className="page-sub">{open.descPt}</p>
          {open.safeguards.map((s: any) => (
            <SafeguardAccordion
              key={s.id}
              safeguard={s}
              item={items[s.id]}
              assessmentId={assessmentId}
              onSaved={() => reload(assessmentId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
