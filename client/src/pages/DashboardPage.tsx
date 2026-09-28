import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useHeader } from '../context/HeaderContext';
import { ChartCard, CalorieTrendChart } from '../components/Charts';
import apiClient from '../api';

interface DashboardStats {
  programCount: number;
  sessionCount: number;
  todayCalories: number;
  recentSessions: Array<{
    id: number;
    program_id: number | null;
    program_name: string;
    duration_minutes: number;
    perceived_effort: number;
    started_at: string;
  }>;
}

interface DailyBreakdown {
  recorded_at: string;
  daily_calories: number;
  entries: number;
}

interface DashboardPayload {
  user: {
    id: number;
    name: string;
    email: string;
    age?: number | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    fitness_goal?: string | null;
  } | null;
  stats: DashboardStats;
  calorieTrendDaily: DailyBreakdown[];
}

function ProgressRing({ value, max, loading, color }: { value: number; max: number; loading?: boolean; color?: string }) {
  if (loading) {
    return (
      <div className="progress-ring" style={{ opacity: 0.3 }}>
        <svg width="52" height="52">
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="4" className="progress-ring-bg" />
        </svg>
      </div>
    );
  }
  const pct = Math.min(value / max, 1);
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  return (
    <div className="progress-ring">
      <svg width="52" height="52">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="progress-ring-bg" />
        <circle
          cx="26" cy="26" r={r} fill="none" strokeWidth="4"
          className="progress-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={color ? { stroke: color } : undefined}
        />
      </svg>
      <div className="progress-ring-text" style={color ? { color } : undefined}>{Math.round(pct * 100)}%</div>
    </div>
  );
}

const CALORIE_GOAL = 2200;
const WEEKLY_SESSION_GOAL = 6;

function StatSkeleton() {
  return (
    <div className="stat-card" aria-hidden="true">
      <div className="stat-content">
        <div className="skeleton sk-stat-label" />
        <div className="skeleton sk-stat-value" />
      </div>
      <div className="skeleton sk-ring" />
    </div>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="chart-card" aria-hidden="true">
      <h3 className="chart-title">{title}</h3>
      <div className="skeleton" style={{ height: 180, width: '100%', borderRadius: 12 }} />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, setUserFromPayload } = useAuth();
  const { setHeader, setPageLoading } = useHeader();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calorieTrend, setCalorieTrend] = useState<{ date: string; value: number }[]>([]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const goalLabels: Record<string, string> = {
    weight_loss: t('goals.weight_loss'),
    muscle_gain: t('goals.build_muscle'),
    endurance: t('goals.endurance'),
    general: t('goals.general'),
  };

  useEffect(() => {
    const userName = user?.name?.trim() || t('common.friend');
    const goalLabel = goalLabels[user?.fitness_goal ?? 'general'] || goalLabels.general;
    const subtitleParts = [goalLabel];
    if (user?.weight_kg) subtitleParts.push(`${user.weight_kg} kg`);
    if (user?.height_cm) subtitleParts.push(`${user.height_cm} cm`);
    setHeader({
      title: t('dashboard.greeting', { name: userName }),
      subtitle: subtitleParts.join(' • '),
    });
  }, [t, user, setHeader]);

  useEffect(() => {
    let cancelled = false;

    setStatsLoading(true);
    setChartLoading(true);
    apiClient.get('/dashboard')
      .then((res) => {
        if (cancelled) return;
        const data = res.data as DashboardPayload;

        if (data.user) {
          const { age, height_cm, weight_kg, fitness_goal, ...rest } = data.user;
          const normalized: any = { ...rest };
          if (age != null)         normalized.age = age;
          if (height_cm != null)   normalized.height_cm = height_cm;
          if (weight_kg != null)   normalized.weight_kg = weight_kg;
          if (fitness_goal != null) normalized.fitness_goal = fitness_goal;
          setUserFromPayload(normalized);
        }

        setStats(data.stats);
        setCalorieTrend(
          (data.calorieTrendDaily || []).map(d => ({
            date: d.recorded_at,
            value: Number(d.daily_calories) || 0,
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setStatsError(err.response?.data?.error || t('common.loadDashboard'));
      })
      .finally(() => {
        if (cancelled) return;
        setStatsLoading(false);
        setChartLoading(false);
      });

    return () => { cancelled = true; };
  }, [t]);

  const anyLoading = statsLoading || chartLoading;

  useEffect(() => {
    setPageLoading(anyLoading);
    return () => setPageLoading(false);
  }, [anyLoading, setPageLoading]);

  // 今日卡路里 vs 昨日对比
  const todayCalories = stats?.todayCalories ?? 0;
  const yesterdayCalories = calorieTrend.length >= 2 ? calorieTrend[calorieTrend.length - 2].value : 0;
  const calorieDelta = todayCalories - yesterdayCalories;

  // 本周训练次数
  const sessionCount = stats?.sessionCount ?? 0;
  const recentSessionsThisWeek = (stats?.recentSessions || []).filter(s => {
    const d = new Date(s.started_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  // BMI 计算
  const weightKg = user?.weight_kg ?? 0;
  const heightM = (user?.height_cm ?? 0) / 100;
  const bmi = heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const bmiProgress = bmi > 0 ? Math.min(Math.max((bmi - 18.5) / (24.9 - 18.5), 0), 1) : 0;

  return (
    <div className="dashboard-page">
      {statsError && <div className="alert alert-error">{statsError}</div>}

      {/* Hero Calorie Card — 对齐 ui-ux-design v2.1 */}
      {statsLoading ? (
        <div className="skeleton" style={{ height: 130, borderRadius: 16, marginBottom: 16 }} aria-hidden="true" />
      ) : (
        <div className="hero-card">
          <div className="hero-kicker">{t('dashboard.todayCalories')}</div>
          <div className="hero-row">
            <span className="hero-value">{todayCalories.toLocaleString()}</span>
            <span className="hero-unit">kcal</span>
          </div>
          <div className="hero-meta">
            {yesterdayCalories > 0 && (
              <span className="hero-chip">
                {calorieDelta <= 0 ? '↓' : '↑'} {Math.abs(calorieDelta)} {t('dashboard.vsYesterday')}
              </span>
            )}
            <span className="hero-chip">🎯 {t('dashboard.calorieGoalChip', { goal: CALORIE_GOAL })}</span>
          </div>
        </div>
      )}

      {/* Two stat cards: Training Sessions + Weight */}
      <div className="stats-grid">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-label">{t('dashboard.trainingSessionsShort')}</div>
                <div className="stat-value">{sessionCount}</div>
                <div className="stat-delta delta-up">▲ {recentSessionsThisWeek} {t('dashboard.thisWeek')}</div>
              </div>
              <ProgressRing value={sessionCount} max={WEEKLY_SESSION_GOAL} color="var(--secondary)" />
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-label">{t('dashboard.weight')}</div>
                <div className="stat-value">{weightKg || '-'}<span className="stat-value-suffix"> kg</span></div>
                <div className="stat-delta delta-up">▲ BMI {bmi.toFixed(1)}</div>
              </div>
              <ProgressRing value={bmiProgress} max={1} color="var(--accent-orange)" />
            </div>
          </>
        )}
      </div>

      {/* Calorie Trend Chart — 无数据时也显示空状态卡片 */}
      {chartLoading ? (
        <ChartSkeleton title={t('dashboard.calorieTrend')} />
      ) : (
        <ChartCard title={t('dashboard.calorieTrend')}>
          {calorieTrend.length > 0 ? (
            <CalorieTrendChart data={calorieTrend} />
          ) : (
            <div className="chart-empty">
              <span className="chart-empty-icon">📊</span>
              <p>{t('dashboard.noChartData')}</p>
            </div>
          )}
        </ChartCard>
      )}

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.quickActions')}</h2>
          </div>
          <div className="quick-actions">
            <Link to="/training" className="action-card">
              <span className="action-icon">🏋️</span>
              <span>{t('dashboard.startSession')}</span>
            </Link>
            <Link to="/diet" className="action-card">
              <span className="action-icon">🍽️</span>
              <span>{t('dashboard.logMeal')}</span>
            </Link>
            <Link to="/training" className="action-card">
              <span className="action-icon">📊</span>
              <span>{t('dashboard.viewStats')}</span>
            </Link>
            <Link to="/training" className="action-card">
              <span className="action-icon">🤖</span>
              <span>{t('dashboard.aiTrain')}</span>
            </Link>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.recentSessions')}</h2>
          </div>
          {statsLoading ? (
            <div className="sk-session-list" aria-hidden="true">
              {[1, 2, 3].map(i => (
                <div key={i} className="sk-session-item">
                  <div className="sk-session-info">
                    <div className="skeleton sk-session-name" />
                    <div className="skeleton sk-session-date" />
                  </div>
                  <div className="skeleton sk-session-meta" />
                </div>
              ))}
            </div>
          ) : stats?.recentSessions && stats.recentSessions.length > 0 ? (
            <div className="session-list">
              {stats.recentSessions.map((s) => {
                const diffMs = Date.now() - new Date(s.started_at).getTime();
                const diffH = Math.floor(diffMs / 3600000);
                const diffD = Math.floor(diffH / 24);
                const relTime = diffD > 0
                  ? t('dashboard.daysAgo', { count: diffD })
                  : diffH > 0
                    ? t('dashboard.hoursAgo', { count: diffH })
                    : t('dashboard.justNow');
                return (
                  <div
                    key={s.id}
                    className="session-item session-item-clickable"
                    onClick={() => navigate(s.program_id ? `/training/session/${s.program_id}` : '/training')}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="session-info">
                      <span className="session-name">{s.program_name || t('common.freestyleWorkout')}</span>
                      <span className="session-date">
                        {relTime}{s.duration_minutes ? ` · ${s.duration_minutes} ${t('common.min')}` : ''}
                      </span>
                    </div>
                    <div className="session-meta">
                      {s.perceived_effort ? <span className="session-effort">{s.perceived_effort}/10</span> : null}
                      <span className="session-go">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted">{t('dashboard.noSessions')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
