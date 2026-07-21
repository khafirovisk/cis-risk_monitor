import { sevKey, SEV_LABEL } from '../lib/risk';

export function RiskMatrix({ counts }: { counts: Record<string, number> }) {
  const cells = [];
  for (let p = 5; p >= 1; p--) {
    for (let i = 1; i <= 5; i++) {
      const s = p * i;
      const k = sevKey(s);
      const n = counts[`${p}-${i}`] || 0;
      cells.push(
        <div
          key={`${p}-${i}`}
          className={`mx-cell${n ? '' : ' empty'}`}
          style={{ background: `var(--${k}-soft)`, color: `var(--${k})` }}
          title={`Prob. ${p} × Impacto ${i} = ${s} (${SEV_LABEL[k]}) — ${n} risco(s)`}
        >
          {n || '·'}
        </div>,
      );
    }
  }
  return (
    <div className="matrix">
      <div className="mx-axis mx-y" style={{ gridRow: '1 / 6' }}>Probabilidade →</div>
      {cells}
      <div />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="mx-axis">{i === 3 ? 'Impacto →' : i}</div>)}
    </div>
  );
}
