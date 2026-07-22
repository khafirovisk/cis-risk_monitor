import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SAML_LOGIN_URL } from '../api/client';
import { useBranding } from '../lib/useBranding';

export function Login() {
  const [showLocal, setShowLocal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { logoUrl } = useBranding();

  async function submitLocal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.localLogin(username, password);
      if (result.mfaRequired) return setMfaStep(true);
      navigate(result.mustChangePassword ? '/trocar-senha' : result.mfaEnrollRequired ? '/mfa/configurar' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Usuário ou senha inválidos.');
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.mfaLoginVerify(mfaToken);
      navigate(result.mustChangePassword ? '/trocar-senha' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Código inválido. Você também pode usar um código de backup.');
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        {logoUrl && <img src={logoUrl} alt="Logo" className="login-logo-img" />}
        <h1 className="page-title">Sentinela CIS</h1>
        {!mfaStep && <a className="btn" href={SAML_LOGIN_URL}>Entrar com SSO corporativo</a>}

        {!showLocal && !mfaStep && (
          <button className="link-btn" onClick={() => setShowLocal(true)}>
            Problemas com o SSO? Entrar com conta local
          </button>
        )}

        {showLocal && !mfaStep && (
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

        {mfaStep && (
          <form onSubmit={submitMfa} className="local-login-form">
            <label>
              Código do autenticador (ou código de backup)
              <input value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit">Confirmar</button>
          </form>
        )}
      </div>
    </div>
  );
}
