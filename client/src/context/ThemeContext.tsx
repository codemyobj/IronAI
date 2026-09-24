import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * Theme modes supported by the app.
 * - `light`  — force light tokens via [data-theme="light"]
 * - `dark`   — force dark tokens via [data-theme="dark"]
 * - `system` — follow prefers-color-scheme (no [data-theme] attribute, CSS auto-fallback)
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Effective theme actually applied to the document.
 * Resolved from ThemeMode + system preference. Useful for icon display.
 */
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** User-selected preference (persisted). */
  theme: ThemeMode;
  /** Resolved theme currently applied to <html>. */
  resolvedTheme: ResolvedTheme;
  /** Set a new preference. Persists to localStorage. */
  setTheme: (theme: ThemeMode) => void;
  /** Convenience: cycle light → dark → system → light. */
  toggleTheme: () => void;
}

const STORAGE_KEY = 'ironai-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Read persisted preference once on init. */
function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage access may throw in private mode — fall back to system
  }
  return 'system';
}

/** Resolve a ThemeMode to actual light/dark using system preference. */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply the theme attribute on <html>. `system` removes the attribute so the
 *  CSS auto-fallback @media block kicks in. */
function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
  // Keep color-scheme in sync so native form controls / scrollbars match.
  const resolved = resolveTheme(mode);
  root.style.colorScheme = resolved;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Optional default when nothing is stored yet. */
  defaultTheme?: ThemeMode;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = getInitialTheme();
    return stored === 'system' ? defaultTheme : stored;
  });

  // resolvedTheme tracks what's actually rendered (light/dark)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialTheme()),
  );

  // Apply theme to <html> whenever it changes
  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(resolveTheme(theme));
  }, [theme]);

  // Listen to system preference changes — only matters in `system` mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolvedTheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / private mode errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to read & control the active theme. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
