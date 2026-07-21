import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Auditoria } from './pages/Auditoria';
import { Riscos } from './pages/Riscos';

export default function App() {
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
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/auditoria">Auditoria</NavLink>
          <NavLink to="/riscos">Riscos</NavLink>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/riscos" element={<Riscos />} />
        </Routes>
      </main>
    </div>
  );
}
