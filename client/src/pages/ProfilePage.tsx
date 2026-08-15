import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { useAuth } from '../hooks/useAuth';
import { useHeader } from '../context/HeaderContext';
import type { ProfileStats, UpdateProfileData, FitnessGoal } from '../types';

const GOAL_OPTIONS: FitnessGoal[] = ['general', 'weight_loss', 'muscle_gain', 'endurance'];

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const { user, updateProfile, logout } = useAuth();
  const { setHeader } = useHeader();

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

  return (
    <div className="profile-page">
      {/* Header card: avatar + name + goal */}
      <section className="profile-hero">
        <div className="profile-avatar">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-name">{user?.name || '-'}</h2>
          <div className="profile-email">{user?.email || '-'}</div>
          <div className="profile-goal-pill">🎯 {goalLabel(user?.fitness_goal)}</div>
        </div>
        <button className="btn btn-primary btn-sm profile-edit-btn" onClick={openEditor}>
          ✏️ {t('profile.edit')}
        </button>
      </section>

      {/* Stats row */}
      <section className="profile-stats">
        <div className="profile-stat-card">
          <div className="stat-num">{stats.totalTrainingSessions}</div>
          <div className="stat-label">
            {t('profile.sessionsTotal')} {t('profile.sessionsUnit')}
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="stat-num">{stats.totalDietRecords}</div>
          <div className="stat-label">
            {t('profile.recordsTotal')} {t('profile.recordsUnit')}
          </div>
        </div>
        {user?.created_at && (
          <div className="profile-stat-card">
            <div className="stat-num date-num">
              {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
            <div className="stat-label">{t('profile.memberSince')}</div>
          </div>
        )}
      </section>

      {/* Info section */}
      <section className="info-section">
        <h3 className="section-header">{t('profile.welcome')}</h3>

        <div className="info-list">
          <div className="info-row">
            <span className="info-key">{t('profile.name')}</span>
            <span className="info-value">{user?.name || '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.email')}</span>
            <span className="info-value mono">{user?.email || '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.age')}</span>
            <span className="info-value">{user?.age ? `${user.age}` : '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.height')}</span>
            <span className="info-value">{user?.height_cm ? `${Number(user.height_cm).toFixed(0)} cm` : '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.weight')}</span>
            <span className="info-value">{user?.weight_kg ? `${Number(user.weight_kg).toFixed(1)} kg` : '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.goal')}</span>
            <span className="info-value">{goalLabel(user?.fitness_goal)}</span>
          </div>
        </div>
      </section>

      {/* Settings section */}
      <section className="info-section">
        <h3 className="section-header">{t('profile.settings')}</h3>
        <div className="info-list">
          <div className="info-row">
            <span className="info-key">{t('profile.language')}</span>
            <div className="lang-options">
              {LANG_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  className={`lang-chip ${currentLang === lang.code ? 'active' : ''}`}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.switchAccount')}</span>
            <button className="btn btn-outline btn-sm" onClick={handleSwitchAccount}>
              {t('profile.switchAccount')}
            </button>
          </div>
          <div className="info-row">
            <span className="info-key">{t('profile.logout')}</span>
            <button className="btn btn-danger btn-sm" onClick={handleLogout}>
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
