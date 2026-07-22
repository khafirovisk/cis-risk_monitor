import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function Seguranca() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSecuritySettings().then(setConfig);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const updated = await api.updateSecuritySettings(config);
    setConfig(updated);
    setSaved(true);
  }

  if (!config) return null;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Segurança</h1>
      <p className="page-sub">Política de senha e MFA aplicadas às contas locais (não afeta o login via SSO).</p>
      <form onSubmit={save} className="card" style={{ maxWidth: 560 }}>
        <div className="form-full" style={{ marginTop: 0 }}>
          <label htmlFor="sec-min-length">Tamanho mínimo da senha</label>
          <input
            className="fld"
            id="sec-min-length"
            type="number"
            min={6}
            max={64}
            value={config.passwordMinLength}
            onChange={(e) => setConfig({ ...config, passwordMinLength: Number(e.target.value) })}
          />
        </div>
        <label className="checkbox-row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireUppercase}
            onChange={(e) => setConfig({ ...config, passwordRequireUppercase: e.target.checked })}
          />
          Exigir letra maiúscula
        </label>
        <label className="checkbox-row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireNumber}
            onChange={(e) => setConfig({ ...config, passwordRequireNumber: e.target.checked })}
          />
          Exigir número
        </label>
        <label className="checkbox-row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireSymbol}
            onChange={(e) => setConfig({ ...config, passwordRequireSymbol: e.target.checked })}
          />
          Exigir símbolo
        </label>
        <label className="checkbox-row" style={{ marginTop: 18 }}>
          <input
            type="checkbox"
            checked={config.mfaRequired}
            onChange={(e) => setConfig({ ...config, mfaRequired: e.target.checked })}
          />
          MFA obrigatório para contas locais
        </label>
        <p className="td-muted" style={{ margin: '8px 0 0' }}>
          Ao ligar, contas locais sem MFA configurado serão levadas a configurá-lo no próximo login.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
          <button className="btn" type="submit">Salvar</button>
          {saved && <span className="saved-note">Configuração salva.</span>}
        </div>
      </form>
    </>
  );
}
