import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useHeader } from '../context/HeaderContext';
import { ChartCard, CalorieTrendChart, TrainingBarChart } from '../components/Charts';
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

function ProgressRing({ value, max, loading }: { value: number; max: number; loading?: boolean }) {
  if (loading) {
    return (
      <div className="progress-ring" style={{ opacity: 0.3 }}>
        <svg width="56" height="56">
          <circle cx="28" cy="28" r="24" fill="none" strokeWidth="5" className="progress-ring-bg" />
        </svg>
      </div>
    );
  }
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
  const { t } = useTranslation();
  const { user, setUserFromPayload } = useAuth();
  const { setHeader, setPageLoading } = useHeader();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calorieTrend, setCalorieTrend] = useState<{ date: string; value: number }[]>([]);
  const [trainingFreq, setTrainingFreq] = useState<{ label: string; value: number }[]>([]);

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
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ===== 聚合接口：1 次请求拿回 Dashboard 需要的所有字段 =====
    // 原来 5 个并发请求 → 现在 1 个请求，省掉 4 次跨太平洋的 RTT。
    setStatsLoading(true);
    setChartLoading(true);
    apiClient.get('/dashboard')
      .then((res) => {
        if (cancelled) return;
        const data = res.data as DashboardPayload;

        // 把聚合接口带回的 user 写回 AuthContext：
        // = 原本首屏要额外花 2-4s 查 /api/auth/me，现在这 1 次请求
        //   同时完成了 5 项数据 + user 的更新。
        if (data.user) {
          // PostgreSQL 里 age/height_cm/weight_kg 可为 null，前端 User 接口
          // 定义为 number | undefined，null 归一化 undefined。
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

        const freqMap = new Array(7).fill(0);
        (data.stats.recentSessions || []).forEach((s: any) => {
          const day = new Date(s.started_at).getDay();
          freqMap[day]++;
        });
        setTrainingFreq(weekdays.map((label, i) => ({ label, value: freqMap[i] })));
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

  return (
    <div className="dashboard-page">
      {statsError && <div className="alert alert-error">{statsError}</div>}

      <div className="stats-grid">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Charts — render independently from stats */}
      {chartLoading ? (
        <>
          <ChartSkeleton title={t('dashboard.calorieTrend')} />
          <ChartSkeleton title={t('dashboard.trainingFrequency')} />
        </>
      ) : (
        <>
          {calorieTrend.length > 0 && (
            <ChartCard title={t('dashboard.calorieTrend')}>
              <CalorieTrendChart data={calorieTrend} />
            </ChartCard>
          )}
          {trainingFreq.some(d => d.value > 0) && (
            <ChartCard title={t('dashboard.trainingFrequency')}>
              <TrainingBarChart data={trainingFreq} />
            </ChartCard>
          )}
        </>
      )}

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
