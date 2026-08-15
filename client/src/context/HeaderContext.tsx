import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface HeaderConfig {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface HeaderContextValue {
  header: HeaderConfig;
  setHeader: (config: HeaderConfig) => void;
  clearHeader: () => void;
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
}

const defaultHeader: HeaderConfig = { title: '' };

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<HeaderConfig>(defaultHeader);
  const [pageLoading, setPageLoading] = useState(false);

  const setHeader = useCallback((config: HeaderConfig) => {
    setHeaderState(config);
  }, []);

  const clearHeader = useCallback(() => {
    setHeaderState(defaultHeader);
  }, []);

  return (
    <HeaderContext.Provider value={{ header, setHeader, clearHeader, pageLoading, setPageLoading }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const ctx = useContext(HeaderContext);
  if (!ctx) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return ctx;
}
