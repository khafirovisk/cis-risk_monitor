import { Link } from 'react-router-dom';

export function Configuracoes() {
  return (
    <>
      <h1 className="page-title">Configurações</h1>
      <p className="page-sub">Ajustes administrativos da aplicação.</p>
      <div className="grid ctrl-grid">
        <Link to="/admin/saml" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">SSO</span>
          <span className="ctrl-name">Configuração do SSO (SAML)</span>
          <span className="td-muted">Entry point, issuer, certificado do IdP e conta local de emergência.</span>
        </Link>
      </div>
    </>
  );
}
