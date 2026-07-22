import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { showToast } from '../lib/toast';

const DEFAULT_ACCENT = '#0C6B34';

function reloadShortly() {
  setTimeout(() => window.location.reload(), 600);
}

export function Branding() {
  const [config, setConfig] = useState<any>(null);
  const [color, setColor] = useState(DEFAULT_ACCENT);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getBranding().then((c) => {
      setConfig(c);
      setColor(c.accentColor || DEFAULT_ACCENT);
    });
  }, []);

  async function saveColor(e: FormEvent) {
    e.preventDefault();
    try {
      await api.updateBranding({ accentColor: color });
      showToast('Cor salva — atualizando a página...');
      reloadShortly();
    } catch {
      showToast('Não foi possível salvar a cor');
    }
  }

  async function restoreDefault() {
    try {
      await api.updateBranding({ accentColor: null });
      showToast('Cor restaurada — atualizando a página...');
      reloadShortly();
    } catch {
      showToast('Não foi possível restaurar a cor padrão');
    }
  }

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadBrandingLogo(file);
      showToast('Logo enviada — atualizando a página...');
      reloadShortly();
    } catch (err: any) {
      showToast(err?.body?.message || 'Não foi possível enviar a logo');
      setUploading(false);
    }
  }

  async function removeLogo() {
    if (!confirm('Remover a logo atual?')) return;
    try {
      await api.removeBrandingLogo();
      showToast('Logo removida — atualizando a página...');
      reloadShortly();
    } catch {
      showToast('Não foi possível remover a logo');
    }
  }

  if (!config) return null;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Branding</h1>
      <p className="page-sub">Logo e cor de destaque exibidas na barra lateral e na tela de login.</p>

      <form onSubmit={saveColor} className="card" style={{ maxWidth: 480 }}>
        <div className="form-full" style={{ marginTop: 0 }}>
          <label htmlFor="br-color">Cor de destaque</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <input
              id="br-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 48, height: 36, padding: 0, border: 'none', background: 'none' }}
            />
            <span className="td-muted">{color}</span>
          </div>
        </div>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
          <button className="btn" type="submit">Salvar cor</button>
          <button className="btn ghost" type="button" onClick={restoreDefault}>Restaurar padrão</button>
        </div>
      </form>

      <div className="card" style={{ maxWidth: 480, marginTop: 16 }}>
        <label htmlFor="br-logo">Logo (PNG ou JPEG, até 2MB)</label>
        {config.hasLogo && (
          <div style={{ margin: '10px 0' }}>
            <img
              src={`${api.brandingLogoUrl}?v=${encodeURIComponent(config.updatedAt)}`}
              alt="Logo atual"
              style={{ maxHeight: 60, maxWidth: 200, display: 'block' }}
            />
          </div>
        )}
        <input id="br-logo" type="file" accept="image/png,image/jpeg" onChange={onFileSelected} disabled={uploading} />
        {config.hasLogo && (
          <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button className="btn danger" type="button" onClick={removeLogo}>Remover logo</button>
          </div>
        )}
      </div>
    </>
  );
}
