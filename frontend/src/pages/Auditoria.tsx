import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LEVEL_COLOR, matPct } from '../lib/maturity';
import { ensureAssessment } from './useAssessment';

const LEVELS = [
  '0 · Inexistente', '1 · Inicial', '2 · Documentado',
  '3 · Implementado', '4 · Gerenciado', '5 · Otimizado',
];

export function Auditoria() {
  const [assessmentId, setId] = useState<string>('');
  const [controls, setControls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);   // controle aberto
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

  async function save(sgId: string, maturity: number | null, na: boolean) {
    await api.setItem(assessmentId, sgId, { maturity, na });
    await reload(assessmentId);
  }

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
          <button className="btn" style={{ background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--border-2)', marginBottom: 12 }} onClick={() => setOpen(null)}>← Voltar</button>
          <h2 className="page-title" style={{ fontSize: 18 }}>{String(open.number).padStart(2, '0')} · {open.titlePt}</h2>
          <p className="page-sub">{open.descPt}</p>
          {open.safeguards.map((s: any) => {
            const it = items[s.id];
            return (
              <div className="card" key={s.id} style={{ marginBottom: 10 }}>
                <div className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{s.code} — {s.titlePt}</div>
                <div style={{ background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)', padding: '8px 12px', borderRadius: '0 8px 8px 0', margin: '8px 0', fontWeight: 600 }}>{s.questionPt}</div>
                <ul style={{ margin: '0 0 8px', paddingLeft: 20, color: 'var(--ink-2)' }}>
                  {s.examplesPt.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="mono" value={it?.na ? 'na' : (it?.maturity ?? '')} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-2)' }}
                    onChange={(e) => {
                      const v = e.target.value;
                      save(s.id, v === 'na' || v === '' ? null : Number(v), v === 'na');
                    }}>
                    <option value="">— não avaliado (0) —</option>
                    {LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                    <option value="na">N/A</option>
                  </select>
                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Evidências: {s.evidenceHintPt}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
