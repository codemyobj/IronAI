import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🏋️</span>
        <span className="navbar-title">IronAI</span>
      </div>

      <div className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Dashboard
        </NavLink>
        <NavLink to="/training" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Training
        </NavLink>
        <NavLink to="/diet" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Diet
        </NavLink>
        <NavLink to="/ai-analysis" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          AI Coach
        </NavLink>
      </div>

      <div className="navbar-user">
        <span className="navbar-user-name">{user?.name}</span>
        <button onClick={logout} className="btn btn-outline btn-sm">
          Logout
        </button>
      </div>
    </nav>
  );
}
