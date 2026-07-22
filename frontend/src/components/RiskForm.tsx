import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { STATUS_LABEL, STATUS_OPTIONS } from '../lib/risk';
import { showToast } from '../lib/toast';

const PROB_LABELS = ['1 · Rara', '2 · Improvável', '3 · Possível', '4 · Provável', '5 · Quase certa'];
const IMP_LABELS = ['1 · Insignificante', '2 · Menor', '3 · Moderado', '4 · Maior', '5 · Severo'];

type TaskDraft = { description: string; assignee: string; dueDate: string; done: boolean };

export function RiskForm({
  risk, controls, onClose, onSaved,
}: {
  risk: any | null; controls: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(risk?.title || '');
  const [description, setDescription] = useState(risk?.description || '');
  const [probInherent, setProbInherent] = useState(risk?.probInherent ?? 3);
  const [impactInherent, setImpactInherent] = useState(risk?.impactInherent ?? 3);
  const [probResidual, setProbResidual] = useState(risk?.probResidual ?? 3);
  const [impactResidual, setImpactResidual] = useState(risk?.impactResidual ?? 3);
  const [ownerName, setOwnerName] = useState(risk?.ownerName || '');
  const [status, setStatus] = useState(risk?.status || 'ABERTO');
  const [selectedControls, setSelectedControls] = useState<number[]>(
    (risk?.controls || []).map((rc: any) => rc.control.number),
  );
  const [tasks, setTasks] = useState<TaskDraft[]>(
    (risk?.tasks || []).map((t: any) => ({
      description: t.description,
      assignee: t.assignee || '',
      done: t.done,
      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : '',
    })),
  );
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleControl(n: number) {
    setSelectedControls((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }
  function addTask() { setTasks((t) => [...t, { description: '', assignee: '', dueDate: '', done: false }]); }
  function updateTask(i: number, patch: Partial<TaskDraft>) {
    setTasks((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeTask(i: number) { setTasks((t) => t.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!title.trim()) {
      showToast('Informe o título do risco');
      titleRef.current?.focus();
      return;
    }
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      probInherent, impactInherent, probResidual, impactResidual,
      ownerName: ownerName.trim() || undefined,
      status,
      controlNumbers: selectedControls,
      tasks: tasks.filter((t) => t.description.trim()).map((t) => ({
        description: t.description.trim(),
        assignee: t.assignee.trim() || undefined,
        dueDate: t.dueDate || undefined,
        done: t.done,
      })),
    };
    const saved = risk ? await api.updateRisk(risk.id, body) : await api.createRisk(body);
    showToast(saved?.aiWarning ? `Risco salvo, mas ${saved.aiWarning}` : 'Risco salvo');
    onSaved();
  }

  async function remove() {
    if (!risk) return;
    if (!confirm(`Excluir o risco "${risk.title}" e suas tarefas?`)) return;
    await api.deleteRisk(risk.id);
    showToast('Risco excluído');
    onSaved();
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2 className="page-title" style={{ fontSize: 17 }}>{risk ? 'Editar risco' : 'Novo risco'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">
          <div className="form-full" style={{ marginTop: 0 }}>
            <label htmlFor="rf-titulo">Título do risco</label>
            <input ref={titleRef} className="fld" id="rf-titulo" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ransomware nos servidores de arquivos" />
          </div>
          <div className="form-full">
            <label htmlFor="rf-desc">Descrição</label>
            <textarea className="fld" id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o cenário de risco, ativos afetados e consequências" />
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label htmlFor="rf-prob">Probabilidade (inerente)</label>
              <select className="fld" id="rf-prob" value={probInherent} onChange={(e) => setProbInherent(+e.target.value)}>
                {PROB_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-imp">Impacto (inerente)</label>
              <select className="fld" id="rf-imp" value={impactInherent} onChange={(e) => setImpactInherent(+e.target.value)}>
                {IMP_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-prob-r">Probabilidade (residual)</label>
              <select className="fld" id="rf-prob-r" value={probResidual} onChange={(e) => setProbResidual(+e.target.value)}>
                {PROB_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-imp-r">Impacto (residual)</label>
              <select className="fld" id="rf-imp-r" value={impactResidual} onChange={(e) => setImpactResidual(+e.target.value)}>
                {IMP_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-resp">Responsável pelo risco</label>
              <input className="fld" id="rf-resp" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex.: Infraestrutura" />
            </div>
            <div className="form-field">
              <label htmlFor="rf-status">Status</label>
              <select className="fld" id="rf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <p className="td-muted" style={{ margin: '8px 0 0' }}>
            O <b>inerente</b> é o risco sem controles; o <b>residual</b> é o risco atual, considerando os controles CIS vinculados e o plano de tratamento.
          </p>
          {risk ? (
            <div className="form-full">
              <label>Controles CIS vinculados (mitigam este risco)</label>
              <div className="ctrl-check-grid">
                {controls.map((c) => (
                  <label className="ctrl-check" key={c.number}>
                    <input type="checkbox" checked={selectedControls.includes(c.number)} onChange={() => toggleControl(c.number)} />
                    <span><b>{String(c.number).padStart(2, '0')}</b> {c.titlePt}</span>
                  </label>
                ))}
              </div>
              <p className="td-muted" style={{ margin: '6px 0 0' }}>
                Mudar o título ou a descrição acima faz a IA reclassificar os controles automaticamente ao salvar,
                substituindo a seleção manual feita aqui.
              </p>
            </div>
          ) : (
            <p className="td-muted" style={{ margin: '8px 0 0' }}>
              Os controles CIS relacionados a este risco serão sugeridos automaticamente por IA ao salvar
              (configurável em Configurações → IA) — se preciso, ajuste depois na edição do risco.
            </p>
          )}
          <div className="form-full">
            <label>Tarefas do plano de tratamento</label>
            {tasks.map((t, i) => (
              <div className={`task-row${t.done ? ' task-done' : ''}`} key={i}>
                <input type="checkbox" checked={t.done} onChange={(e) => updateTask(i, { done: e.target.checked })} title="Concluída" />
                <input className="fld" value={t.description} onChange={(e) => updateTask(i, { description: e.target.value })} placeholder="Descrição da tarefa" />
                <input className="fld" value={t.assignee} onChange={(e) => updateTask(i, { assignee: e.target.value })} placeholder="Responsável" />
                <input className="fld" type="date" value={t.dueDate} onChange={(e) => updateTask(i, { dueDate: e.target.value })} title="Prazo" />
                <button className="rm" title="Remover tarefa" onClick={() => removeTask(i)}>✕</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={addTask} style={{ marginTop: 4 }}>+ Adicionar tarefa</button>
          </div>
          <div className="modal-actions">
            {risk && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={remove}>Excluir risco</button>}
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn" onClick={save}>Salvar risco</button>
          </div>
        </div>
      </div>
    </div>
  );
}
