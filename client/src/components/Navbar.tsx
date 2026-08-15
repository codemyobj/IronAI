import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Tab icons — stroke-based (2px width) in inactive state, fill on active.
 * Matches the design reference image:
 *   Home    = house with door outline
 *   Train   = lightning bolt
 *   Diet    = plate with heart-shaped food on top
 *   AI      = 5-point star with 4 sparkles around
 *   Profile = person silhouette (head + shoulders)
 */
const icons = {
  // House: triangular roof + rectangular body + door opening
  home: 'M3 11 L12 3 L21 11 L21 20 C21 20.55 20.55 21 20 21 H4 C3.45 21 3 20.55 3 20 Z M10 21 V15 H14 V21',

  // Lightning bolt: sharp diagonal zigzag
  train: 'M13 2 L5 13 H11 L9 22 L19 10 H13 Z',

  // Plate (ellipse base + two horizontal handles) + heart above it
  diet: 'M3 15 C3 12 7 10 12 10 C17 10 21 12 21 15 C21 18 17 20 12 20 C7 20 3 18 3 15 Z M1 15 L1 16 M23 15 L23 16 M11 7 C11 5.5 12 4.5 13 4.5 C14 4.5 15 5.5 15 7 C15 8.2 13 10 13 10 C13 10 11 8.2 11 7 Z',

  // 5-point star + 4 small dots at top / bottom / left / right
  ai: 'M12 1.5 L14.4 8.1 L21.3 8.3 L15.7 12.5 L17.6 19.3 L12 15.7 L6.4 19.3 L8.3 12.5 L2.7 8.3 L9.6 8.1 Z M12 0 L12 1 M24 12 L23 12 M12 24 L12 23 M0 12 L1 12',

  // Person: head circle + shoulders
  profile: 'M12 11 C14.2 11 16 9.2 16 7 C16 4.8 14.2 3 12 3 C9.8 3 8 4.8 8 7 C8 9.2 9.8 11 12 11 Z M20 21 V19 C20 16.2 16.4 14 12 14 C7.6 14 4 16.2 4 19 V21',
};

/** Renders a single tab icon SVG. Some icons need multiple paths / dots. */
function TabIcon({ name }: { name: keyof typeof icons }) {
  if (name === 'diet') {
    // Plate + heart rendered as separate elements so heart sits above plate.
    // But for simplicity keep it as one path matching icons.diet.
    return (
      <svg viewBox="0 0 24 24" className="tab-icon">
        {/* Plate */}
        <path d="M3 15 C3 12 7 10 12 10 C17 10 21 12 21 15 C21 18 17 20 12 20 C7 20 3 18 3 15 Z" />
        {/* Handles */}
        <line x1="1" y1="15" x2="3" y2="15" />
        <line x1="21" y1="15" x2="23" y2="15" />
        {/* Heart food on top of plate */}
        <path
          d="M9 7 C9 5.3 10.3 4 12 4 C13.7 4 15 5.3 15 7 C15 8.6 12 11 12 11 C12 11 9 8.6 9 7 Z"
          transform="translate(-0.3, -0.2)"
        />
      </svg>
    );
  }
  if (name === 'ai') {
    return (
      <svg viewBox="0 0 24 24" className="tab-icon">
        {/* 5-point star */}
        <path d="M12 1.5 L14.4 8.1 L21.3 8.3 L15.7 12.5 L17.6 19.3 L12 15.7 L6.4 19.3 L8.3 12.5 L2.7 8.3 L9.6 8.1 Z" />
        {/* 4 sparkles as small circles */}
        <circle cx="12" cy="0.2" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="23.8" cy="12" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="12" cy="23.8" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="0.2" cy="12" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <path d={icons[name]} />
    </svg>
  );
}

export default function Navbar() {
  const { t } = useTranslation();
  return (
    <nav className="navbar">
      <div className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon name="home" />
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/training" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon name="train" />
          <span>{t('nav.train')}</span>
        </NavLink>
        <NavLink to="/diet" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon name="diet" />
          <span>{t('nav.diet')}</span>
        </NavLink>
        <NavLink to="/ai-analysis" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon name="ai" />
          <span>{t('nav.ai')}</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <TabIcon name="profile" />
          <span>{t('nav.profile')}</span>
        </NavLink>
      </div>
    </nav>
  );
}
