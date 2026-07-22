import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SAML_LOGIN_URL } from '../api/client';

export function Login() {
  const [showLocal, setShowLocal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submitLocal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.localLogin(username, password);
      navigate(result.mustChangePassword ? '/trocar-senha' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Usuário ou senha inválidos.');
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1 className="page-title">Sentinela CIS</h1>
        <a className="btn" href={SAML_LOGIN_URL}>Entrar com SSO corporativo</a>

        {!showLocal && (
          <button className="link-btn" onClick={() => setShowLocal(true)}>
            Problemas com o SSO? Entrar com conta local
          </button>
        )}

        {showLocal && (
          <form onSubmit={submitLocal} className="local-login-form">
            <label>
              Usuário
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </label>
            <label>
              Senha
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit">Entrar</button>
          </form>
        )}
      </div>
    </div>
  );
}
