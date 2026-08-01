import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* Closed-path icons — fill on active, stroke on inactive */
const icons = {
  home: 'M12 3 L21 10 V20 H3 V10 Z',
  train: 'M13 2 L4 14 H11 L10 22 L19 10 H12 Z',
  diet: 'M12 6 C8 3 4 4 4 9 C4 15 8 21 12 21 C16 21 20 15 20 9 C20 4 16 3 12 6 Z',
  ai: 'M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z',
};

function TabIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <path d={d} />
    </svg>
  );
}

export default function Navbar() {
  const { t } = useTranslation();
  return (
    <nav className="navbar">
      <div className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon d={icons.home} />
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/training" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon d={icons.train} />
          <span>{t('nav.train')}</span>
        </NavLink>
        <NavLink to="/diet" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon d={icons.diet} />
          <span>{t('nav.diet')}</span>
        </NavLink>
        <NavLink to="/ai-analysis" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon d={icons.ai} />
          <span>{t('nav.ai')}</span>
        </NavLink>
      </div>
    </nav>
  );
}
