import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { lighten, pickInkColor, isValidHexColor } from './color';

export function useBranding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getBranding()
      .then((config) => {
        if (config.accentColor && isValidHexColor(config.accentColor)) {
          const soft = lighten(config.accentColor, 0.85);
          const ink = pickInkColor(config.accentColor);
          document.documentElement.style.setProperty('--accent', config.accentColor);
          if (soft) document.documentElement.style.setProperty('--accent-soft', soft);
          document.documentElement.style.setProperty('--accent-ink', ink);
        }
        setLogoUrl(config.hasLogo ? `${api.brandingLogoUrl}?v=${encodeURIComponent(config.updatedAt)}` : null);
      })
      .catch(() => {
        setLogoUrl(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { logoUrl, loading };
}
