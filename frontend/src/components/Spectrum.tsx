import { LEVEL_COLOR } from '../lib/maturity';

export function Spectrum({
  controls, statsFor, onSelect,
}: {
  controls: any[];
  statsFor: (c: any) => { avg: number | null; answered: number; total: number };
  onSelect: (c: any) => void;
}) {
  return (
    <div className="spectrum" role="img" aria-label="Espectro de maturidade dos 18 controles CIS">
      {controls.map((c) => {
        const st = statsFor(c);
        const h = st.avg != null ? Math.max(6, (st.avg / 5) * 100) : 3;
        const col = st.avg != null ? LEVEL_COLOR(Math.round(st.avg)) : 'var(--ink-3)';
        return (
          <button
            key={c.number}
            className="spec-col"
            title={`Controle ${String(c.number).padStart(2, '0')} · ${c.titlePt} — maturidade ${st.avg != null ? st.avg.toFixed(1) : 'n/a'}/5 (${st.answered}/${st.total} avaliadas)`}
            onClick={() => onSelect(c)}
          >
            <span className="spec-track">
              <span className="spec-bar" style={{ height: `${h}%`, background: col, opacity: st.avg == null ? 0.35 : 1 }} />
            </span>
            <span className="spec-lbl">{String(c.number).padStart(2, '0')}</span>
          </button>
        );
      })}
    </div>
  );
}
