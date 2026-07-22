import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ensureAssessment } from './useAssessment';

function levelText(m: number | null | undefined, na: boolean) {
  if (na) return 'N/A';
  if (m == null) return 'Não avaliado';
  return `Nível ${m}`;
}

export function Relatorio() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [exportPayload, setExportPayload] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      const [controls, full, risks] = await Promise.all([api.controls(), api.assessment(a.id), api.risks()]);
      const itemsById: Record<string, any> = {};
      full.items.forEach((it: any) => (itemsById[it.safeguardId] = it));
      const list: any[] = [];
      controls.forEach((c: any) => c.safeguards.forEach((s: any) => {
        const it = itemsById[s.id];
        const evCount = (it?.evidenceText?.trim() ? 1 : 0) + (it?.evidences?.length || 0);
        list.push({
          code: s.code,
          titlePt: s.titlePt,
          controlTitle: c.titlePt,
          igs: ['ig1', 'ig2', 'ig3'].filter((k) => s[k]).map((k) => k.toUpperCase()),
          maturity: it?.maturity ?? null,
          na: !!it?.na,
          evCount,
          updatedAt: it?.updatedAt || null,
        });
      }));
      setRows(list);
      setExportPayload({
        versao: 'CIS v8.1.2', escopo: 'IG' + a.scopeIg, exportadoEm: new Date().toISOString(),
        avaliacao: full, riscos: risks,
      });
    })().catch(console.error);
  }, []);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sentinela-cis-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!rows) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatório da avaliação</h1>
          <p className="page-sub">Consolidado por salvaguarda no escopo selecionado. O export em JSON inclui a avaliação CIS e o registro de riscos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportJSON}>Exportar JSON</button>
          <button className="btn ghost" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Salvaguarda</th><th>IG</th><th>Maturidade</th><th>Evidências</th><th>Atualizado</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><b className="num">{r.code}</b> {r.titlePt}<div className="td-muted">{r.controlTitle}</div></td>
                <td>{r.igs.map((g: string) => <span key={g} className="tag ig">{g}</span>)}</td>
                <td>{levelText(r.maturity, r.na)}</td>
                <td>{r.evCount ? `📎 ${r.evCount}` : <span className="td-muted">—</span>}</td>
                <td className="td-muted num">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
