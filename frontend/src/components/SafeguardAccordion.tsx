import { useState } from 'react';
import { api } from '../api/client';

const LEVELS = [
  { v: 0, nome: '0 · Inexistente', desc: 'Nada implementado' },
  { v: 1, nome: '1 · Inicial', desc: 'Esforços pontuais, sem processo' },
  { v: 2, nome: '2 · Documentado', desc: 'Política definida, aplicação parcial' },
  { v: 3, nome: '3 · Implementado', desc: 'Aplicado na maior parte do ambiente' },
  { v: 4, nome: '4 · Gerenciado', desc: 'Medido e monitorado com indicadores' },
  { v: 5, nome: '5 · Otimizado', desc: 'Automatizado, melhoria contínua' },
];

function levelPill(m: number | null | undefined, na: boolean) {
  if (na) return <span className="pill p-neutral"><span className="dot" />N/A</span>;
  if (m == null) return <span className="pill p-neutral"><span className="dot" />Não avaliado</span>;
  const cls = m <= 1 ? 'p-crit' : m === 2 ? 'p-high' : m === 3 ? 'p-med' : 'p-low';
  return <span className={`pill ${cls}`}><span className="dot" />Nível {m}</span>;
}

export function SafeguardAccordion({
  safeguard, item, assessmentId, onSaved,
}: {
  safeguard: any; item: any; assessmentId: string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [maturity, setMaturity] = useState<number | null>(item?.maturity ?? null);
  const [na, setNa] = useState<boolean>(!!item?.na);
  const [evidenceText, setEvidenceText] = useState(item?.evidenceText || '');
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    await api.setItem(assessmentId, safeguard.id, { maturity: na ? null : maturity, na, evidenceText });
    setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    onSaved();
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      await api.uploadEvidences(assessmentId, safeguard.id, Array.from(files));
      onSaved();
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidence(id: string) {
    await api.deleteEvidence(id);
    onSaved();
  }

  const evCount = (item?.evidenceText?.trim() ? 1 : 0) + (item?.evidences?.length || 0);

  return (
    <div className={`sg${open ? ' open' : ''}`}>
      <button className="sg-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="sg-id num">{safeguard.code}</span>
        <span className="sg-title">{safeguard.titlePt}</span>
        <span className="sg-badges">
          {['ig1', 'ig2', 'ig3'].filter((k) => safeguard[k]).map((k) => <span key={k} className="tag ig">{k.toUpperCase()}</span>)}
          {evCount > 0 && <span className="tag">📎 {evCount}</span>}
          {levelPill(item?.maturity, !!item?.na)}
        </span>
        <span className="sg-caret">›</span>
      </button>
      {open && (
        <div className="sg-body">
          <div className="q-label">Pergunta do auditor</div>
          <div className="question">{safeguard.questionPt}</div>
          <details className="official">
            <summary>Texto oficial da salvaguarda (EN): {safeguard.titleEn}</summary>
            <p>{safeguard.descriptionEn}</p>
          </details>

          <div className="q-label">Como alcançar a conformidade — exemplos práticos</div>
          <ul className="examples">{safeguard.examplesPt.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>

          <div className="q-label">Evidências típicas aceitas em auditoria</div>
          <div className="evd-hint">{safeguard.evidenceHintPt}</div>

          <div className="q-label">Nível de maturidade</div>
          <div className="mat-scale">
            {LEVELS.map((l) => (
              <div className="mat-opt" key={l.v}>
                <input
                  type="radio"
                  name={`m-${safeguard.id}`}
                  id={`m-${safeguard.id}-${l.v}`}
                  checked={!na && maturity === l.v}
                  onChange={() => { setNa(false); setMaturity(l.v); }}
                />
                <label htmlFor={`m-${safeguard.id}-${l.v}`}><b>{l.nome}</b>{l.desc}</label>
              </div>
            ))}
            <div className="mat-opt">
              <input
                type="radio"
                name={`m-${safeguard.id}`}
                id={`m-${safeguard.id}-na`}
                checked={na}
                onChange={() => setNa(true)}
              />
              <label htmlFor={`m-${safeguard.id}-na`}><b>N/A</b>Não se aplica ao ambiente</label>
            </div>
          </div>

          <div className="q-label">Evidências</div>
          <textarea
            className="evd"
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
            placeholder="Descreva as evidências: links para políticas, nº de chamados, prints, relatórios..."
          />
          <div className="file-row">
            <label className="file-btn">
              + Anexar arquivo
              <input type="file" multiple style={{ display: 'none' }} disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
            </label>
            {(item?.evidences || []).map((f: any) => (
              <span className="file-chip" key={f.id}>
                <a href={api.evidenceUrl(f.id)} target="_blank" rel="noreferrer">📄 {f.filename}</a>
                <button title="Remover" onClick={() => removeEvidence(f.id)}>✕</button>
              </span>
            ))}
          </div>
          <div className="sg-save-row">
            <button className="btn" onClick={save}>Salvar avaliação</button>
            {savedAt && <span className="saved-note">Salvo às {savedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
