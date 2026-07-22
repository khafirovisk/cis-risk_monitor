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
        <Link to="/configuracoes/usuarios" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">ACESSO</span>
          <span className="ctrl-name">Usuários</span>
          <span className="td-muted">Pessoas que já autenticaram via SSO, com e-mail e papel.</span>
        </Link>
        <Link to="/configuracoes/seguranca" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">SEG</span>
          <span className="ctrl-name">Segurança</span>
          <span className="td-muted">Política de senha e exigência de MFA para contas locais.</span>
        </Link>
        <Link to="/configuracoes/branding" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">MARCA</span>
          <span className="ctrl-name">Branding</span>
          <span className="td-muted">Logo e cor de destaque exibidas na barra lateral e na tela de login.</span>
        </Link>
        <Link to="/configuracoes/ia" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">IA</span>
          <span className="ctrl-name">IA</span>
          <span className="td-muted">Serviço de IA que sugere os controles CIS associados a um risco.</span>
        </Link>
      </div>
    </>
  );
}
