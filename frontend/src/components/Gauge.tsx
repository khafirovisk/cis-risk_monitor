import { GAUGE_BANDS } from '../lib/maturity';

// Velocímetro de maturidade (0..100%). Arcos acompanhando o círculo (sweep-flag 1).
export function Gauge({ pct }: { pct: number | null }) {
  const cx = 125, cy = 125, r = 100, w = 16;
  const ang = (v: number) => 180 - v * 1.8;
  const pt = (deg: number, rr: number): [number, number] => [
    cx + rr * Math.cos((deg * Math.PI) / 180),
    cy - rr * Math.sin((deg * Math.PI) / 180),
  ];

  const arcs = GAUGE_BANDS.map((b, i) => {
    const [x1, y1] = pt(ang(b.lo) - 1.2, r);
    const [x2, y2] = pt(ang(b.hi) + 1.2, r);
    return (
      <path key={i}
        d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
        stroke={b.c} strokeWidth={w} fill="none" strokeLinecap="round" />
    );
  });

  const ticks = [0, 20, 40, 60, 80, 100].map((v) => {
    const [tx, ty] = pt(ang(v), r + 13);
    return (
      <text key={v} x={tx.toFixed(1)} y={ty.toFixed(1)} fontSize="8.5" fill="var(--ink-3)"
        fontFamily="var(--font-mono)" textAnchor="middle" dominantBaseline="middle">{v}%</text>
    );
  });

  const nv = pct == null ? 0 : pct;
  const [nx, ny] = pt(ang(nv), r - 24);
  const [tx0, ty0] = pt(ang(nv) + 180, 12);

  return (
    <svg viewBox="0 0 250 186" style={{ width: 280, maxWidth: '100%' }}
      role="img" aria-label={`Maturidade ${pct != null ? pct + '%' : 'não avaliada'}`}>
      {arcs}{ticks}
      <line x1={tx0.toFixed(2)} y1={ty0.toFixed(2)} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
        stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
      <text x={cx} y={cy + 36} fontSize="32" fontWeight="700" fill="var(--ink)"
        fontFamily="var(--font-mono)" textAnchor="middle">{pct != null ? pct + '%' : '—'}</text>
      <text x={cx} y={cy + 52} fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)"
        textAnchor="middle" letterSpacing="1.5">MATURIDADE</text>
    </svg>
  );
}
