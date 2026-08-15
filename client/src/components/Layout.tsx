import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useHeader } from '../context/HeaderContext';
import { useEffect } from 'react';

export default function Layout() {
  const { header, clearHeader, pageLoading } = useHeader();

  useEffect(() => {
    return () => clearHeader();
  }, [clearHeader]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-text">
            {header.title && <h1>{header.title}</h1>}
            {header.subtitle && String(header.subtitle).trim() && (
              <p className="text-muted">{header.subtitle}</p>
            )}
          </div>
          {header.actions && <div className="app-header-actions">{header.actions}</div>}
        </div>
      </header>
      <main className={`main-content ${pageLoading ? 'is-loading' : ''}`}>
        <Outlet />
      </main>
      <Navbar />
    </div>
  );
}
