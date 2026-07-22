import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Auditoria } from './pages/Auditoria';
import { Riscos } from './pages/Riscos';
import { Relatorio } from './pages/Relatorio';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { AdminSaml } from './pages/AdminSaml';
import { Configuracoes } from './pages/Configuracoes';
import { Usuarios } from './pages/Usuarios';
import { Seguranca } from './pages/Seguranca';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toast } from './components/Toast';
import { api } from './api/client';

export default function App() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => setRole(u?.role || null))
      .catch(() => setRole(null));
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
              <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Sentinela CIS</div>
            <div className="brand-sub">Controls v8.1.2</div>
          </div>
        </div>
        <div className="nav">
          <div className="nav-label">Visão geral</div>
          <NavLink to="/dashboard"><span className="ico">◧</span> Dashboard</NavLink>
          <div className="nav-label">Conformidade &amp; risco</div>
          <NavLink to="/auditoria"><span className="ico">▤</span> Auditoria</NavLink>
          <NavLink to="/riscos"><span className="ico">⚠</span> Riscos</NavLink>
          <div className="nav-label">Saída</div>
          <NavLink to="/relatorio"><span className="ico">✎</span> Relatório &amp; export</NavLink>
        </div>
        <div className="sidebar-foot">
          {role === 'ADMIN' && (
            <NavLink to="/configuracoes" className={({ isActive }) => `settings-btn${isActive ? ' active' : ''}`}>
              <span className="ico">⚙</span> Configurações
            </NavLink>
          )}
          CIS Controls v8.1.2 (mar/2025).
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/trocar-senha" element={<ChangePassword />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><Auditoria /></ProtectedRoute>} />
          <Route path="/riscos" element={<ProtectedRoute><Riscos /></ProtectedRoute>} />
          <Route path="/relatorio" element={<ProtectedRoute><Relatorio /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
          <Route path="/configuracoes/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
          <Route path="/configuracoes/seguranca" element={<ProtectedRoute><Seguranca /></ProtectedRoute>} />
          <Route path="/admin/saml" element={<ProtectedRoute><AdminSaml /></ProtectedRoute>} />
        </Routes>
      </main>
      <Toast />
    </div>
  );
}
