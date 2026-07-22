import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function AdminSaml() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSamlConfig().then(setConfig);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const updated = await api.updateSamlConfig(config);
    setConfig(updated);
    setSaved(true);
  }

  if (!config) return null;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Configuração do SSO (SAML)</h1>
      <p className="page-sub">Alterações aqui têm efeito imediato, sem precisar reiniciar a aplicação.</p>
      <form onSubmit={save} className="card" style={{ maxWidth: 640 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          Habilitado
        </label>
        <div className="form-full">
          <label htmlFor="saml-entry">Entry Point (URL de login do IdP)</label>
          <input className="fld" id="saml-entry" value={config.entryPoint || ''} onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })} />
        </div>
        <div className="form-full">
          <label htmlFor="saml-issuer">Issuer / Entity ID</label>
          <input className="fld" id="saml-issuer" value={config.issuer || ''} onChange={(e) => setConfig({ ...config, issuer: e.target.value })} />
        </div>
        <div className="form-full">
          <label htmlFor="saml-callback">Callback URL (ACS)</label>
          <input className="fld" id="saml-callback" value={config.callbackUrl || ''} onChange={(e) => setConfig({ ...config, callbackUrl: e.target.value })} />
        </div>
        <div className="form-full">
          <label htmlFor="saml-cert">Certificado do IdP (X.509)</label>
          <textarea className="fld" id="saml-cert" rows={6} value={config.idpCert || ''} onChange={(e) => setConfig({ ...config, idpCert: e.target.value })} />
        </div>
        <label className="checkbox-row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={config.wantAssertionsSigned}
            onChange={(e) => setConfig({ ...config, wantAssertionsSigned: e.target.checked })}
          />
          Exigir asserções assinadas
        </label>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
          <button className="btn" type="submit">Salvar</button>
          {saved && <span className="saved-note">Configuração salva.</span>}
        </div>
      </form>
    </>
  );
}
