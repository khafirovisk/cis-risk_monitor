import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Gauge } from '../components/Gauge';
import { Spectrum } from '../components/Spectrum';
import { RiskMatrix } from '../components/RiskMatrix';
import { LEVEL_COLOR } from '../lib/maturity';
import { isActive, sevKey, SEV_LABEL, taskStats } from '../lib/risk';
import { computeInsights } from '../lib/insights';
import { ensureAssessment } from './useAssessment';

const igField = (ig: number) => (ig === 1 ? 'ig1' : ig === 3 ? 'ig3' : 'ig2');

export function Dashboard() {
  const [sum, setSum] = useState<any>(null);
  const [controls, setControls] = useState<any[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, any>>({});
  const [risks, setRisks] = useState<any[]>([]);
  const [matrixMode, setMatrixMode] = useState<'inerente' | 'residual'>('residual');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      const [s, cs, full, rs] = await Promise.all([
        api.summary(a.id), api.controls(), api.assessment(a.id), api.risks(),
      ]);
      setSum(s);
      setControls(cs);
      setRisks(rs);
      const map: Record<string, any> = {};
      full.items.forEach((it: any) => (map[it.safeguardId] = it));
      setItemsById(map);
    })().catch(console.error);
  }, []);

  if (!sum) return <p className="page-sub">Carregando…</p>;

  const ig = igField(sum.scopeIg);
  const scopedSafeguards = (c: any) => c.safeguards.filter((s: any) => s[ig]);

  function ctrlStats(c: any) {
    const sgs = scopedSafeguards(c);
    let answered = 0, applicable = 0, total = 0;
    sgs.forEach((s: any) => {
      const it = itemsById[s.id];
      if (it?.na) return;
      applicable++;
      if (it && typeof it.maturity === 'number') { answered++; total += it.maturity; }
    });
    return { total: sgs.length, answered, applicable, avg: applicable ? total / applicable : null };
  }

  const activeRisks = risks.filter((r) => isActive(r.status));
  const sevAltos = activeRisks.filter((r) => r.probResidual * r.impactResidual >= 10).length;
  let overdueTotal = 0, openTasks = 0;
  risks.forEach((r) => {
    const ts = taskStats(r.tasks || []);
    overdueTotal += ts.overdue;
    openTasks += ts.total - ts.done;
  });

  const kpis = [
    { label: 'Maturidade CIS', value: sum.pct != null ? sum.pct + '%' : '—', sub: sum.avg != null ? `média ${sum.avg.toFixed(1)}/5 · IG${sum.scopeIg}` : `escopo IG${sum.scopeIg}` },
    { label: 'Salvaguardas avaliadas', value: `${sum.answered}/${sum.total}`, sub: `${Math.round((sum.answered / Math.max(sum.total, 1)) * 100)}% do escopo` },
    { label: 'Riscos ativos', value: activeRisks.length, sub: `${sevAltos} altos/críticos (residual)` },
    { label: 'Tarefas em aberto', value: openTasks, sub: overdueTotal ? <span className="overdue">{overdueTotal} em atraso</span> : 'nenhuma em atraso' },
  ];

  const matrixCounts: Record<string, number> = {};
  activeRisks.forEach((r) => {
    const p = matrixMode === 'residual' ? r.probResidual : r.probInherent;
    const i = matrixMode === 'residual' ? r.impactResidual : r.impactInherent;
    const k = `${p}-${i}`;
    matrixCounts[k] = (matrixCounts[k] || 0) + 1;
  });

  const dist = { none: 0, low01: 0, l2: 0, l3: 0, high45: 0, na: 0 };
  let total = 0;
  controls.forEach((c) => scopedSafeguards(c).forEach((s: any) => {
    total++;
    const it = itemsById[s.id];
    if (!it || (it.maturity == null && !it.na)) { dist.none++; return; }
    if (it.na) { dist.na++; return; }
    const m = it.maturity;
    if (m <= 1) dist.low01++;
    else if (m === 2) dist.l2++;
    else if (m === 3) dist.l3++;
    else dist.high45++;
  }));
  const distSegs = [
    { n: dist.none, color: 'var(--surface-2)', label: 'Não avaliado' },
    { n: dist.low01, color: 'var(--crit)', label: 'Nível 0–1' },
    { n: dist.l2, color: 'var(--high)', label: 'Nível 2' },
    { n: dist.l3, color: 'var(--med)', label: 'Nível 3' },
    { n: dist.high45, color: 'var(--low)', label: 'Nível 4–5' },
    { n: dist.na, color: 'var(--border-2)', label: 'N/A' },
  ];

  const insights = computeInsights(controls, itemsById, risks, sum.scopeIg);

  const sortedByPriority = [...activeRisks].sort(
    (a, b) => b.probResidual * b.impactResidual - a.probResidual * a.impactResidual,
  );
  function avgMaturityForRisk(r: any) {
    const nums = (r.controls || [])
      .map((rc: any) => ctrlStats(controls.find((c) => c.number === rc.control.number) || { safeguards: [] }).avg)
      .filter((v: any) => v != null);
    return nums.length ? nums.reduce((s: number, v: number) => s + v, 0) / nums.length : null;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Visão geral — maturidade &amp; riscos</h1>
          <p className="page-sub">Avaliação de maturidade CIS Controls v8.1.2 integrada ao registro de riscos: veja onde os riscos mais severos encontram controles menos maduros.</p>
        </div>
      </div>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="label">{k.label}</div>
            <div className="value num">{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card gauge-card" style={{ marginTop: 14 }}>
        <span className="card-eyebrow">Maturidade geral</span>
        <h2 className="card-title">Índice de maturidade CIS Controls v8.1.2</h2>
        <div className="gauge-wrap">
          <Gauge pct={sum.pct} />
          <div className="gauge-info">
            <div className="lead">
              {sum.avg != null ? <>média <b>{sum.avg.toFixed(1)}</b> / 5 · <b>{sum.pct}%</b> de maturidade</> : 'nenhuma salvaguarda aplicável no escopo'}
              <div style={{ marginTop: 4 }}>{sum.answered}/{sum.total} salvaguardas avaliadas no escopo IG{sum.scopeIg}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card spectrum-card" style={{ marginTop: 14 }}>
        <div className="spectrum-top">
          <div>
            <span className="card-eyebrow">Espectro de maturidade</span>
            <h2 className="card-title">Cobertura dos 18 controles CIS</h2>
            <p className="card-sub" style={{ marginBottom: 0 }}>Cada barra é um controle (01–18); a altura mostra a maturidade média das salvaguardas no escopo. Clique para auditar.</p>
          </div>
        </div>
        <Spectrum controls={controls} statsFor={ctrlStats} onSelect={() => navigate('/auditoria')} />
      </div>

      <div className="grid two-col" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <h2 className="card-title">Matriz de riscos</h2>
              <p className="card-sub">Riscos ativos por probabilidade × impacto</p>
            </div>
            <div className="ig-opts">
              <button className={`ig-opt${matrixMode === 'inerente' ? ' active' : ''}`} onClick={() => setMatrixMode('inerente')}>Inerente</button>
              <button className={`ig-opt${matrixMode === 'residual' ? ' active' : ''}`} onClick={() => setMatrixMode('residual')}>Residual</button>
            </div>
          </div>
          <RiskMatrix counts={matrixCounts} />
          <div className="legend">
            <span><i style={{ background: 'var(--low)' }} />Baixo (1–4)</span>
            <span><i style={{ background: 'var(--med)' }} />Médio (5–9)</span>
            <span><i style={{ background: 'var(--high)' }} />Alto (10–16)</span>
            <span><i style={{ background: 'var(--crit)' }} />Crítico (17–25)</span>
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Distribuição da avaliação CIS</h2>
          <p className="card-sub">Salvaguardas no escopo, por nível de maturidade</p>
          <div className="seg-track">
            {distSegs.filter((s) => s.n > 0).map((s) => (
              <div key={s.label} className="seg" style={{ width: `${(s.n / Math.max(total, 1)) * 100}%`, background: s.color }} title={`${s.label}: ${s.n}`} />
            ))}
          </div>
          <div className="legend">
            {distSegs.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label} ({s.n})</span>)}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Insights automáticos</h2>
        <p className="card-sub">Inconsistências e pendências detectadas cruzando avaliação e riscos — clique para ir até o módulo.</p>
        {insights.length === 0 ? (
          <p className="td-muted" style={{ margin: '4px 0' }}>✅ Nenhuma inconsistência detectada nos dados registrados até aqui.</p>
        ) : insights.map((it, i) => (
          <button key={i} className="bar-row" style={{ gridTemplateColumns: '26px 1fr auto' }} onClick={() => navigate('/' + it.view)}>
            <span>{it.sev === 'crit' ? '⛔' : it.sev === 'high' ? '⚠️' : 'ℹ️'}</span>
            <span className="bar-label" style={{ whiteSpace: 'normal' }}>{it.text}</span>
            <span className="td-muted">abrir →</span>
          </button>
        ))}
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Prioridades: riscos × maturidade dos controles</h2>
        <p className="card-sub">Riscos ordenados por severidade, com a maturidade dos controles CIS vinculados. Severidade alta + controle imaturo = prioridade de tratamento.</p>
        {sortedByPriority.length === 0 ? (
          <p className="td-muted" style={{ margin: '6px 0' }}>Nenhum risco ativo registrado. Cadastre riscos na aba <b>Riscos</b> e vincule aos controles CIS.</p>
        ) : sortedByPriority.map((r) => {
          const sev = r.probResidual * r.impactResidual;
          const avgM = avgMaturityForRisk(r);
          const prio = sev >= 10 && (avgM == null || avgM < 3);
          const k = sevKey(sev);
          return (
            <div className="xrow" key={r.id}>
              <div className="xt">
                <b>{r.title}</b>
                <div className="xchips">
                  {(r.controls || []).length === 0 ? <span className="td-muted">Nenhum controle vinculado</span> : r.controls.map((rc: any) => {
                    const m = ctrlStats(controls.find((c) => c.number === rc.control.number) || { safeguards: [] }).avg;
                    const col = LEVEL_COLOR(m == null ? null : Math.round(m));
                    return (
                      <span key={rc.control.number} className="xchip" style={{ color: m == null ? 'var(--ink-3)' : col, borderColor: m == null ? 'var(--border-2)' : col }}>
                        C{String(rc.control.number).padStart(2, '0')} · {m != null ? m.toFixed(1) : 'não avaliado'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`pill p-${k}`}><span className="dot" />{SEV_LABEL[k]} ({sev})</span>
                <div className="td-muted num" style={{ marginTop: 3 }}>maturidade média: {avgM != null ? avgM.toFixed(1) : '—'}</div>
                {prio && <div style={{ marginTop: 4 }}><span className="prio-flag">⚑ Prioridade</span></div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Maturidade por controle</h2>
        <p className="card-sub">Média das salvaguardas avaliadas (escala 0–5) — clique para abrir o controle</p>
        {controls.map((c) => {
          const st = ctrlStats(c);
          return (
            <button key={c.number} className="bar-row" onClick={() => navigate('/auditoria')}>
              <span className="bar-label" title={c.titlePt}>{String(c.number).padStart(2, '0')} · {c.titlePt}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${st.avg != null ? (st.avg / 5) * 100 : 0}%`, background: LEVEL_COLOR(st.avg == null ? null : Math.round(st.avg)) }} /></span>
              <span className="bar-val num">{st.avg != null ? st.avg.toFixed(1) : '—'} · {st.answered}/{st.total}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
