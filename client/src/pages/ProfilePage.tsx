import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { useAuth } from '../hooks/useAuth';
import { useHeader } from '../context/HeaderContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import type { ProfileStats, UpdateProfileData, FitnessGoal } from '../types';

const GOAL_OPTIONS: FitnessGoal[] = ['general', 'weight_loss', 'muscle_gain', 'endurance'];

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
] as const;

// 主题切换选项 — 严格对齐 ui-ux-design v2.1 的 segmented control
const THEME_OPTIONS: { code: ThemeMode; icon: string }[] = [
  { code: 'light', icon: '☀' },
  { code: 'dark', icon: '☾' },
  { code: 'system', icon: '⌂' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const { user, updateProfile, logout } = useAuth();
  const { setHeader } = useHeader();
  const { theme, setTheme } = useTheme();

  const [stats, setStats] = useState<ProfileStats>({ totalTrainingSessions: 0, totalDietRecords: 0 });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit form state
  const [form, setForm] = useState<UpdateProfileData>({});

  useEffect(() => {
    apiClient.get('/auth/profile/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const handleLogout = () => {
    if (window.confirm(t('profile.logoutConfirm'))) {
      logout();
      navigate('/login');
    }
  };

  const handleSwitchAccount = () => {
    if (window.confirm(t('profile.switchAccountConfirm'))) {
      logout();
      navigate('/login');
    }
  };

  useEffect(() => {
    setHeader({
      title: t('profile.title'),
    });
  }, [t, setHeader]);

  const openEditor = () => {
    if (!user) return;
    setForm({
      name: user.name ?? '',
      age: user.age ?? undefined,
      height_cm: user.height_cm ?? undefined,
      weight_kg: user.weight_kg ?? undefined,
      fitness_goal: user.fitness_goal ?? 'general',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await updateProfile(form);
      setNotice({ type: 'success', text: t('profile.saved') });
      setEditing(false);
      setTimeout(() => setNotice(null), 2500);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.error || t('profile.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const goalLabel = (g?: FitnessGoal) =>
    g ? (t(`profile.goals.${g}`) as string) : '-';

  // 副标题：@昵称 · 加入时间 · 目标
  const handle = (user?.name || 'user').toLowerCase().replace(/\s+/g, '');
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    : '';
  // 注册以来的天数（"连续"卡）
  const streakDays = user?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000))
    : 0;
  const subtitleParts = [`@${handle}`];
  if (joinDate) subtitleParts.push(t('profile.joinedOn', { date: joinDate }));
  subtitleParts.push(goalLabel(user?.fitness_goal));

  return (
    <div className="profile-page">
      {/* Hero: 全宽渐变 cover + 头像压边 + 编辑按钮，名字/副标题在下方 */}
      <section className="profile-hero">
        <div className="profile-cover">
          <button
            type="button"
            className="profile-edit-btn"
            onClick={openEditor}
            title={t('profile.edit')}
            aria-label={t('profile.edit')}
          >
            ✏️
          </button>
        </div>
        <div className="profile-avatar">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <h2 className="profile-name">{user?.name || '-'}</h2>
        <div className="profile-sub">{subtitleParts.join(' · ')}</div>
      </section>

      {/* 统计 2×2 网格（对齐设计高保真） */}
      <section className="profile-stats">
        <div className="profile-stat-card accent-teal">
          <div className="stat-num">
            {stats.totalTrainingSessions}
            <span className="stat-unit">{t('profile.sessionsUnit')}</span>
          </div>
          <div className="stat-label">{t('profile.statTraining')}</div>
        </div>
        <div className="profile-stat-card accent-green">
          <div className="stat-num">
            {streakDays}
            <span className="stat-unit">天</span>
          </div>
          <div className="stat-label">{t('profile.statStreak')}</div>
        </div>
        <div className="profile-stat-card accent-orange">
          <div className="stat-num">
            {stats.totalDietRecords}
            <span className="stat-unit">{t('profile.recordsUnit')}</span>
          </div>
          <div className="stat-label">{t('profile.statDiet')}</div>
        </div>
        <div className="profile-stat-card accent-purple">
          <div className="stat-num">
            {user?.weight_kg ? Number(user.weight_kg).toFixed(1) : '-'}
            <span className="stat-unit">kg</span>
          </div>
          <div className="stat-label">{t('profile.statWeight')}</div>
        </div>
      </section>

      {/* 设置列表（图标式 setting-row，对齐设计图） */}
      <section className="info-section">
        <h3 className="section-header">{t('profile.settings')}</h3>
        <div className="info-list">
          {/* 目标与身体数据 → 打开编辑弹窗 */}
          <button type="button" className="setting-row" onClick={openEditor}>
            <span className="setting-ic" aria-hidden="true">🎯</span>
            <span className="setting-txt">
              <strong>{t('profile.bodyData')}</strong>
              <span>
                {goalLabel(user?.fitness_goal)}
                {user?.weight_kg ? ` · ${Number(user.weight_kg).toFixed(0)} kg` : ''}
                {user?.height_cm ? ` · ${Number(user.height_cm).toFixed(0)} cm` : ''}
              </span>
            </span>
            <span className="setting-chev" aria-hidden="true">›</span>
          </button>

          {/* 语言 */}
          <div className="setting-row">
            <span className="setting-ic" aria-hidden="true">🌐</span>
            <span className="setting-txt">
              <strong>{t('profile.language')}</strong>
              <span>{LANG_OPTIONS.find((l) => l.code === currentLang)?.label || ''}</span>
            </span>
            <div className="lang-options">
              {LANG_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-chip ${currentLang === lang.code ? 'active' : ''}`}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 主题外观 */}
          <div className="setting-row">
            <span className="setting-ic" aria-hidden="true">⚙️</span>
            <span className="setting-txt">
              <strong>{t('profile.theme')}</strong>
              <span>{t(`profile.theme_${theme}`)}</span>
            </span>
            <div className="segmented" role="tablist" aria-label={t('profile.theme')}>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  role="tab"
                  tabIndex={0}
                  aria-selected={theme === opt.code}
                  className={`segmented-item ${theme === opt.code ? 'active' : ''}`}
                  onClick={() => setTheme(opt.code)}
                  title={t(`profile.theme_${opt.code}`)}
                >
                  <span className="seg-icon" aria-hidden="true">{opt.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 切换账号 */}
          <div className="setting-row">
            <span className="setting-ic" aria-hidden="true">🔁</span>
            <span className="setting-txt">
              <strong>{t('profile.switchAccount')}</strong>
              <span>{user?.email || ''}</span>
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleSwitchAccount}>
              {t('profile.switchAccount')}
            </button>
          </div>

          {/* 退出登录 */}
          <div className="setting-row">
            <span className="setting-ic setting-ic-danger" aria-hidden="true">🚪</span>
            <span className="setting-txt">
              <strong className="danger-text">{t('profile.logout')}</strong>
              <span>{t('profile.logoutConfirm')}</span>
            </span>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
              {t('profile.logout')}
            </button>
          </div>
        </div>
      </section>

      {/* Save notice (outside modal — visible after modal closes on success) */}
      {notice && !editing && (
        <div className={`alert alert-${notice.type}`}>
          {notice.text}
        </div>
      )}

      {/* Edit modal */}
      {editing && user && (
        <div className="modal-overlay" onClick={() => !saving && setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('profile.edit')}</h2>
              <button className="btn-close" onClick={() => !saving && setEditing(false)} disabled={saving}>✕</button>
            </div>
            <div className="modal-body">
              {/* Error notice inside modal so user sees it during editing */}
              {notice && (
                <div className={`alert alert-${notice.type}`} style={{ marginBottom: '12px' }}>
                  {notice.text}
                </div>
              )}
              <div className="form-group">
                <label>{t('profile.name')}</label>
                <input
                  type="text"
                  value={(form.name as string) || ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t('profile.age')}</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={(form.age as number) ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, age: e.target.value === '' ? undefined : Number(e.target.value) }))
                  }
                />
              </div>
              <div className="form-group">
                <label>{t('profile.height')}</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={(form.height_cm as number) ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      height_cm: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label>{t('profile.weight')}</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={(form.weight_kg as number) ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      weight_kg: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label>{t('profile.goal')}</label>
                <select
                  value={form.fitness_goal || 'general'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fitness_goal: e.target.value as FitnessGoal }))
                  }
                >
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {t(`profile.goals.${g}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-outline"
                  onClick={() => !saving && setEditing(false)}
                  disabled={saving}
                >
                  {t('profile.cancel')}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '...' : t('profile.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
