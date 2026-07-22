import { FormEvent, useEffect, useState } from 'react';
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
      <h1 className="page-title">Configuração do SSO (SAML)</h1>
      <p className="page-sub">Alterações aqui têm efeito imediato, sem precisar reiniciar a aplicação.</p>
      <form onSubmit={save} className="card local-login-form" style={{ maxWidth: 640 }}>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />{' '}
          Habilitado
        </label>
        <label>
          Entry Point (URL de login do IdP)
          <input value={config.entryPoint || ''} onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })} />
        </label>
        <label>
          Issuer / Entity ID
          <input value={config.issuer || ''} onChange={(e) => setConfig({ ...config, issuer: e.target.value })} />
        </label>
        <label>
          Callback URL (ACS)
          <input value={config.callbackUrl || ''} onChange={(e) => setConfig({ ...config, callbackUrl: e.target.value })} />
        </label>
        <label>
          Certificado do IdP (X.509)
          <textarea rows={6} value={config.idpCert || ''} onChange={(e) => setConfig({ ...config, idpCert: e.target.value })} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.wantAssertionsSigned}
            onChange={(e) => setConfig({ ...config, wantAssertionsSigned: e.target.checked })}
          />{' '}
          Exigir asserções assinadas
        </label>
        <button className="btn" type="submit">Salvar</button>
        {saved && <p>Configuração salva.</p>}
      </form>
    </>
  );
}
