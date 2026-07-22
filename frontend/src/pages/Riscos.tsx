import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { sevKey, SEV_LABEL, STATUS_LABEL, STATUS_PILL_CLASS, taskStats } from '../lib/risk';
import { RiskForm } from '../components/RiskForm';

export function Riscos() {
  const [risks, setRisks] = useState<any[]>([]);
  const [controls, setControls] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const [rs, cs] = await Promise.all([api.risks(), api.controls()]);
    setRisks(rs);
    setControls(cs);
  }
  useEffect(() => { load().catch(console.error); }, []);

  function openNew() { setEditing(null); setFormOpen(true); }
  function openEdit(r: any) { setEditing(r); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }
  async function afterSave() { closeForm(); await load(); }

  const pill = (s: number) => {
    const k = sevKey(s);
    return <span className={`pill p-${k}`}><span className="dot" />{SEV_LABEL[k]} ({s})</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Registro de riscos</h1>
          <p className="page-sub">Registre os riscos mapeados, atribua impacto, probabilidade, responsável, tarefas com prazos e vincule aos controles CIS que os mitigam.</p>
        </div>
        <button className="btn" onClick={openNew}>+ Novo risco</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Risco</th><th>Inerente</th><th>Residual</th><th>Responsável</th><th>Status</th><th>Controles CIS</th><th>Tarefas</th></tr>
          </thead>
          <tbody>
            {risks.length === 0 && (
              <tr><td colSpan={7} style={{ color: 'var(--ink-3)' }}>Nenhum risco registrado ainda. Clique em <b>+ Novo risco</b> para começar.</td></tr>
            )}
            {[...risks].sort((a, b) => b.probResidual * b.impactResidual - a.probResidual * a.impactResidual).map((r) => {
              const si = r.probInherent * r.impactInherent;
              const sr = r.probResidual * r.impactResidual;
              const ts = taskStats(r.tasks || []);
              return (
                <tr key={r.id} className="clickable" onClick={() => openEdit(r)}>
                  <td style={{ minWidth: 220 }}>
                    <b>{r.title}</b>
                    {r.description && (
                      <div className="td-muted" style={{ maxWidth: '46ch' }}>
                        {r.description.length > 110 ? r.description.slice(0, 110) + '…' : r.description}
                      </div>
                    )}
                  </td>
                  <td>{pill(si)}<div className="td-muted num" style={{ marginTop: 2 }}>P{r.probInherent} × I{r.impactInherent}</div></td>
                  <td>{pill(sr)}<div className="td-muted num" style={{ marginTop: 2 }}>P{r.probResidual} × I{r.impactResidual}</div></td>
                  <td style={{ color: 'var(--ink-3)' }}>{r.ownerName || '—'}</td>
                  <td><span className={`pill ${STATUS_PILL_CLASS[r.status] || 'p-neutral'}`}><span className="dot" />{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td>
                    {(r.controls || []).length
                      ? r.controls.map((rc: any) => <span key={rc.control.number} className="tag ig">C{String(rc.control.number).padStart(2, '0')}</span>)
                      : <span className="td-muted">—</span>}
                  </td>
                  <td className="num">
                    {ts.done}/{ts.total}
                    {ts.overdue > 0 && <div className="overdue">⚠ {ts.overdue} atrasada(s)</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && <RiskForm risk={editing} controls={controls} onClose={closeForm} onSaved={afterSave} />}
    </>
  );
}
