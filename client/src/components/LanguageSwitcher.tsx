import { useTranslation } from 'react-i18next';

const LANGS = ['en', 'zh', 'es'] as const;
const LABELS: Record<string, string> = { en: 'EN', zh: '中', es: 'ES' };
const TITLES: Record<string, string> = {
  en: 'Switch language',
  zh: '切换语言',
  es: 'Cambiar idioma',
};

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.split('-')[0] || 'en';
  const nextIdx = (LANGS.indexOf(current as typeof LANGS[number]) + 1) % LANGS.length;
  const next = LANGS[nextIdx];

  return (
    <button
      className="lang-switcher"
      onClick={() => i18n.changeLanguage(next)}
      title={TITLES[current] || 'Switch language'}
    >
      {LABELS[current] || 'EN'}
    </button>
  );
}
