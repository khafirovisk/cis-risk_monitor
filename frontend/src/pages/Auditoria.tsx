import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LEVEL_COLOR, ctrlStats, scopedSafeguards, assessmentStats, levelLabel, matPct } from '../lib/maturity';
import { ensureAssessment } from './useAssessment';
import { SafeguardAccordion } from '../components/SafeguardAccordion';

export function Auditoria() {
  const [assessmentId, setId] = useState<string>('');
  const [controls, setControls] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [scopeIg, setScopeIg] = useState<number | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [items, setItems] = useState<Record<string, any>>({});

  async function reload(id: string) {
    const a = await api.assessment(id);
    const map: Record<string, any> = {};
    a.items.forEach((it: any) => (map[it.safeguardId] = it));
    setItems(map);
  }

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      setId(a.id);
      setScopeIg(a.scopeIg);
      const [cs, rs] = await Promise.all([api.controls(), api.risks()]);
      setControls(cs);
      setRisks(rs);
      await reload(a.id);
    })().catch(console.error);
  }, []);

  if (scopeIg == null || !controls.length) return <p className="page-sub">Carregando…</p>;

  const stats = assessmentStats(controls, items, scopeIg);
  const linkedRisks = open ? risks.filter((r) => (r.controls || []).some((rc: any) => rc.control.number === open.number)) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Auditoria — CIS Controls v8.1.2</h1>
          <p className="page-sub">Clique em um controle para responder às perguntas de auditoria de cada salvaguarda e registrar as evidências.</p>
        </div>
        <div className="ig-inline" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="k mono" style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Escopo</span>
          <div className="ig-opts">
            {[1, 2, 3].map((n) => (
              <button key={n} className={`ig-opt${scopeIg === n ? ' active' : ''}`} onClick={() => setScopeIg(n)}>IG{n}</button>
            ))}
          </div>
        </div>
      </div>

      {!open && (
        <div className="card card-pad aud-mat" style={{ marginBottom: 14 }}>
          {stats.avg != null ? (
            <>
              <span className="k">Maturidade geral</span>
              <span className="aud-mat-val num">{stats.pct}%</span>
              <span className="td-muted">média {stats.avg.toFixed(1)}/5 · {stats.answered}/{stats.total} avaliadas</span>
            </>
          ) : (
            <span className="td-muted">Nenhuma salvaguarda avaliada ainda no escopo IG{scopeIg}.</span>
          )}
        </div>
      )}

      {!open ? (
        <div className="grid ctrl-grid">
          {controls.map((c) => {
            const st = ctrlStats(c, items, scopeIg);
            const { cls, label } = levelLabel(st.avg == null ? null : Math.round(st.avg), false);
            const col = LEVEL_COLOR(st.avg == null ? null : Math.round(st.avg));
            return (
              <div className="card ctrl-card" key={c.number} tabIndex={0} onClick={() => setOpen(c)} onKeyDown={(e) => e.key === 'Enter' && setOpen(c)}>
                <span className="ctrl-num">CONTROLE {String(c.number).padStart(2, '0')}</span>
                <span className="ctrl-name">{c.titlePt}</span>
                <span className="ctrl-meta">{st.total} salvaguardas no escopo IG{scopeIg}</span>
                <span className="ctrl-pct-row">
                  <span className="ctrl-pct" style={{ color: st.avg != null ? col : 'var(--ink-3)' }}>{matPct(st.avg) != null ? matPct(st.avg) + '%' : '—'}</span>
                  <span className="progress"><i style={{ width: `${st.avg != null ? (st.avg / 5) * 100 : 0}%`, background: col }} /></span>
                </span>
                <span className="ctrl-foot">
                  <span>{st.answered}/{st.total} avaliadas</span>
                  <span className={`pill ${cls}`}><span className="dot" />{label}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <button className="back-btn" onClick={() => setOpen(null)}>← Voltar à auditoria</button>
          {(() => {
            const st = ctrlStats(open, items, scopeIg);
            const col = LEVEL_COLOR(st.avg == null ? null : Math.round(st.avg));
            const { cls, label } = levelLabel(st.avg == null ? null : Math.round(st.avg), false);
            return (
              <div className="page-head">
                <div>
                  <div className="ctrl-num">CONTROLE {String(open.number).padStart(2, '0')} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {open.titleEn}</span></div>
                  <h1 className="page-title">{open.titlePt}</h1>
                  <p className="page-sub">{open.descPt}</p>
                  {linkedRisks.length > 0 && (
                    <p className="page-sub" style={{ marginTop: 6 }}>
                      <b>Riscos vinculados:</b> {linkedRisks.map((r) => r.title).join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.01em', color: st.avg != null ? col : 'var(--ink-3)' }}>
                    {matPct(st.avg) != null ? `${matPct(st.avg)}%` : '—'}
                  </div>
                  <div style={{ margin: '4px 0' }}><span className={`pill ${cls}`}><span className="dot" />{label}</span></div>
                  <div className="td-muted">{st.answered}/{st.total} salvaguardas avaliadas{st.avg != null ? ` · média ${st.avg.toFixed(1)}/5` : ''}</div>
                </div>
              </div>
            );
          })()}
          {scopedSafeguards(open, scopeIg).map((s: any) => (
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
