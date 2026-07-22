import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError('A nova senha precisa ter ao menos 8 caracteres.');
    if (newPassword !== confirm) return setError('As senhas não coincidem.');
    try {
      await api.changePassword(currentPassword, newPassword);
      navigate('/dashboard');
    } catch {
      setError('Senha atual incorreta.');
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={submit} className="card login-card local-login-form">
        <h1 className="page-title">Troca de senha obrigatória</h1>
        <p className="page-sub">
          Este é o primeiro acesso com a conta local. Defina uma nova senha para continuar.
        </p>
        <label>
          Senha atual
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
        </label>
        <label>
          Nova senha
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <label>
          Confirmar nova senha
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Salvar e continuar</button>
      </form>
    </div>
  );
}
