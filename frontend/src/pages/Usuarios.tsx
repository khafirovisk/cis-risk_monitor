import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', AUDITOR: 'Auditor', LEITOR: 'Leitor' };

export function Usuarios() {
  const [users, setUsers] = useState<any[] | null>(null);

  useEffect(() => {
    api.users().then(setUsers).catch(console.error);
  }, []);

  if (!users) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Usuários</h1>
      <p className="page-sub">
        Pessoas que já autenticaram via SSO (SAML) na aplicação. O papel exibido é o que veio do IdP no
        primeiro login — trocas de papel feitas depois no IdP não são re-sincronizadas automaticamente.
      </p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th>Primeiro login</th></tr></thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Ninguém autenticou via SSO ainda.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td style={{ color: 'var(--ink-3)' }}>{u.name || '—'}</td>
                <td><span className="tag ig">{ROLE_LABEL[u.role] || u.role}</span></td>
                <td className="td-muted num">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
