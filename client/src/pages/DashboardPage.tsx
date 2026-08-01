import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { DashboardSkeleton } from '../components/Skeleton';
import apiClient from '../api';

interface DashboardStats {
  programCount: number;
  sessionCount: number;
  todayCalories: number;
  recentSessions: Array<{
    id: number;
    program_name: string;
    duration_minutes: number;
    perceived_effort: number;
    started_at: string;
  }>;
}

function ProgressRing({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  const r = 24;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  return (
    <div className="progress-ring">
      <svg width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="progress-ring-bg" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="progress-ring-fill"
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="progress-ring-text">{Math.round(pct * 100)}%</div>
    </div>
  );
}

const CALORIE_GOAL = 2200;

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [programsRes, sessionsRes, dietRes] = await Promise.all([
          apiClient.get('/training/programs'),
          apiClient.get('/training/sessions', { params: { limit: 5 } }),
          apiClient.get('/diet/records', { params: { date: today } }),
        ]);

        const todayCalories = dietRes.data.records.reduce(
          (sum: number, r: any) => sum + Number(r.calories || 0),
          0
        );

        setStats({
          programCount: programsRes.data.programs.length,
          sessionCount: sessionsRes.data.sessions.length,
          todayCalories,
          recentSessions: sessionsRes.data.sessions,
        });
      } catch (err: any) {
        setError(err.response?.data?.error || t('common.loadDashboard'));
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const goalLabels: Record<string, string> = {
    lose_weight: t('goals.weight_loss'),
    build_muscle: t('goals.build_muscle'),
    endurance: t('goals.endurance'),
    general: t('goals.general'),
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>{t('dashboard.greeting', { name: user?.name })}</h1>
          <p className="text-muted">
            {goalLabels[user?.fitness_goal ?? 'general']}
            {user?.weight_kg && ` • ${user.weight_kg} kg`}
            {user?.height_cm && ` • ${user.height_cm} cm`}
          </p>
        </div>
        <button onClick={logout} className="btn btn-ghost btn-sm" title={t('common.logout')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">{t('dashboard.todayCalories')}</div>
            <div className="stat-value">{stats?.todayCalories ?? 0}<span className="stat-value-suffix"> {t('dashboard.calorieGoal', { goal: CALORIE_GOAL })}</span></div>
          </div>
          <ProgressRing value={stats?.todayCalories ?? 0} max={CALORIE_GOAL} />
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">{t('dashboard.trainingPrograms')}</div>
            <div className="stat-value">{stats?.programCount ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">{t('dashboard.recentSessions')}</div>
            <div className="stat-value">{stats?.sessionCount ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.quickActions')}</h2>
          </div>
          <div className="quick-actions">
            <Link to="/training" className="action-card">
              <span className="action-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <span>{t('dashboard.newProgram')}</span>
            </Link>
            <Link to="/diet" className="action-card">
              <span className="action-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 11h18M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/></svg>
              </span>
              <span>{t('dashboard.logMeal')}</span>
            </Link>
            <Link to="/ai-analysis" className="action-card">
              <span className="action-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              </span>
              <span>{t('dashboard.startSession')}</span>
            </Link>
            <Link to="/ai-analysis" className="action-card">
              <span className="action-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>
              </span>
              <span>{t('dashboard.aiAnalysis')}</span>
            </Link>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.recentSessions')}</h2>
          </div>
          {stats?.recentSessions && stats.recentSessions.length > 0 ? (
            <div className="session-list">
              {stats.recentSessions.map((s) => (
                <div key={s.id} className="session-item">
                  <div className="session-info">
                    <span className="session-name">{s.program_name || t('common.freestyleWorkout')}</span>
                    <span className="session-date">
                      {new Date(s.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="session-meta">
                    {s.duration_minutes && <span>{s.duration_minutes} {t('common.min')}</span>}
                    {s.perceived_effort && <span>{t('common.effort', { value: s.perceived_effort })}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">{t('dashboard.noSessions')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
