import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { showToast } from '../lib/toast';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', AUDITOR: 'Auditor', LEITOR: 'Leitor' };
const ROLE_OPTIONS = ['ADMIN', 'AUDITOR', 'LEITOR'];

function mfaStatusLabel(account: any): string {
  if (account.mfaEnabled) return 'Habilitado';
  return 'Desabilitado';
}

export function Usuarios() {
  const [users, setUsers] = useState<any[] | null>(null);
  const [localAccounts, setLocalAccounts] = useState<any[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('AUDITOR');
  const [password, setPassword] = useState('');

  function reload() {
    api.users().then(setUsers).catch(console.error);
    api.localAccounts().then(setLocalAccounts).catch(console.error);
  }

  useEffect(reload, []);

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Informe usuário e senha inicial');
      return;
    }
    try {
      await api.createLocalAccount({ username: username.trim(), name: name.trim() || undefined, role, password });
      showToast('Usuário local criado');
      setShowForm(false);
      setUsername('');
      setName('');
      setRole('AUDITOR');
      setPassword('');
      reload();
    } catch (err: any) {
      showToast(err?.body?.message || 'Não foi possível criar o usuário');
    }
  }

  async function resetMfa(id: string) {
    if (!confirm('Resetar o MFA desta conta? O usuário precisará configurar novamente no próximo login.')) return;
    await api.resetMfa(id);
    showToast('MFA resetado');
    reload();
  }

  if (!users || !localAccounts) return <p className="page-sub">Carregando…</p>;

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
          <thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th></tr></thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--ink-3)' }}>Ninguém autenticou via SSO ainda.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td style={{ color: 'var(--ink-3)' }}>{u.name || '—'}</td>
                <td><span className="tag ig">{ROLE_LABEL[u.role] || u.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="page-title" style={{ fontSize: 18, marginTop: 28 }}>Usuários locais</h2>
      <p className="page-sub">Contas com login e senha próprios, independentes do SSO.</p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>MFA</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {localAccounts.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--ink-3)' }}>Nenhum usuário local criado ainda.</td></tr>
            )}
            {localAccounts.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td style={{ color: 'var(--ink-3)' }}>{a.name || '—'}</td>
                <td><span className="tag ig">{ROLE_LABEL[a.role] || a.role}</span></td>
                <td>{mfaStatusLabel(a)}</td>
                <td className="td-muted">
                  {a.lockedUntil && new Date(a.lockedUntil).getTime() > Date.now() ? 'Bloqueada' : a.mustChangePassword ? 'Aguardando 1º login' : 'Ativa'}
                </td>
                <td>
                  {a.mfaEnabled && (
                    <button className="btn ghost sm" onClick={() => resetMfa(a.id)}>Resetar MFA</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Cancelar' : '+ Novo usuário local'}
      </button>

      {showForm && (
        <form onSubmit={createAccount} className="card" style={{ maxWidth: 480, marginTop: 12 }}>
          <div className="form-full" style={{ marginTop: 0 }}>
            <label htmlFor="la-username">Usuário</label>
            <input className="fld" id="la-username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="form-full">
            <label htmlFor="la-name">Nome (opcional)</label>
            <input className="fld" id="la-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-full">
            <label htmlFor="la-role">Papel</label>
            <select className="fld" id="la-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label htmlFor="la-password">Senha inicial</label>
            <input className="fld" id="la-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="td-muted" style={{ margin: '8px 0 0' }}>
            A troca de senha será exigida no primeiro login dessa conta.
          </p>
          <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
            <button className="btn" type="submit">Criar usuário</button>
          </div>
        </form>
      )}
    </>
  );
}
