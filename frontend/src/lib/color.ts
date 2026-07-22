function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

// Clareia a cor em direção ao branco — usado pro tom "soft" (fundos suaves).
export function lighten(hex: string, amount: number): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const mix = (c: number) => c + (255 - c) * amount;
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`;
}

// Luminância relativa (fórmula WCAG) — decide se o texto sobre a cor deve ser
// claro ou escuro pra manter contraste legível.
export function pickInkColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return luminance > 0.45 ? '#17241C' : '#FFFFFF';
}

export function isValidHexColor(hex: string): boolean {
  return hexToRgb(hex) !== null;
}
