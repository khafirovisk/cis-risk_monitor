import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function MfaEnroll() {
  const [enrollment, setEnrollment] = useState<any>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.mfaEnroll().then(setEnrollment).catch(() => setError('Não foi possível iniciar o cadastro de MFA.'));
  }, []);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.mfaEnrollVerify(token);
      setBackupCodes(result.backupCodes);
    } catch {
      setError('Código inválido. Confira o horário do dispositivo e tente novamente.');
    }
  }

  if (backupCodes) {
    return (
      <div className="login-page">
        <div className="card login-card">
          <h1 className="page-title">MFA configurado</h1>
          <p className="page-sub">
            Guarde estes 10 códigos de backup em local seguro — cada um só pode ser usado uma vez, caso você perca
            acesso ao aplicativo autenticador. Eles não serão mostrados novamente.
          </p>
          <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {backupCodes.join('\n')}
          </pre>
          <button className="btn" onClick={() => navigate('/dashboard')}>Concluir</button>
        </div>
      </div>
    );
  }

  if (error && !enrollment) {
    return (
      <div className="login-page">
        <div className="card login-card">
          <h1 className="page-title">Configurar MFA</h1>
          <p className="error">{error}</p>
          <button className="btn ghost" onClick={() => navigate('/login')}>Voltar ao login</button>
        </div>
      </div>
    );
  }

  if (!enrollment) return <p className="page-sub">Carregando…</p>;

  return (
    <div className="login-page">
      <form onSubmit={confirm} className="card login-card local-login-form">
        <h1 className="page-title">Configurar MFA</h1>
        <p className="page-sub">Escaneie o QR com um aplicativo autenticador (Google Authenticator, Authy, etc.).</p>
        <img src={enrollment.qrDataUrl} alt="QR code do MFA" width={200} height={200} />
        <p className="td-muted">Ou insira manualmente: <code>{enrollment.secret}</code></p>
        <label>
          Código de 6 dígitos
          <input value={token} onChange={(e) => setToken(e.target.value)} autoFocus maxLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Confirmar</button>
      </form>
    </div>
  );
}
