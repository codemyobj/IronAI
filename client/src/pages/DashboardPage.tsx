import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import { useAuth } from '../hooks/useAuth';

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

export default function DashboardPage() {
  const { user } = useAuth();
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
          (sum: number, r: any) => sum + (r.calories || 0),
          0
        );

        setStats({
          programCount: programsRes.data.programs.length,
          sessionCount: sessionsRes.data.sessions.length,
          todayCalories,
          recentSessions: sessionsRes.data.sessions,
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="page-loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight',
    build_muscle: 'Build Muscle',
    endurance: 'Endurance',
    general: 'General Fitness',
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Welcome back, {user?.name}!</h1>
        <p className="text-muted">
          Goal: {goalLabels[user?.fitness_goal ?? 'general']}
          {user?.weight_kg && ` • ${user.weight_kg} kg`}
          {user?.height_cm && ` • ${user.height_cm} cm`}
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-value">{stats?.programCount ?? 0}</div>
          <div className="stat-label">Training Programs</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏋️</div>
          <div className="stat-value">{stats?.sessionCount ?? 0}</div>
          <div className="stat-label">Recent Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🍽️</div>
          <div className="stat-value">{stats?.todayCalories ?? 0}</div>
          <div className="stat-label">Today's Calories</div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link to="/training" className="action-card">
              <span className="action-icon">➕</span>
              <span>New Training Program</span>
            </Link>
            <Link to="/diet" className="action-card">
              <span className="action-icon">📝</span>
              <span>Log Today's Meals</span>
            </Link>
            <Link to="/ai-analysis" className="action-card">
              <span className="action-icon">🤖</span>
              <span>AI Training Analysis</span>
            </Link>
            <Link to="/ai-analysis" className="action-card">
              <span className="action-icon">🥗</span>
              <span>AI Diet Coach</span>
            </Link>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Training Sessions</h2>
          </div>
          {stats?.recentSessions && stats.recentSessions.length > 0 ? (
            <div className="session-list">
              {stats.recentSessions.map((s) => (
                <div key={s.id} className="session-item">
                  <div className="session-info">
                    <span className="session-name">{s.program_name || 'Freestyle Workout'}</span>
                    <span className="session-date">
                      {new Date(s.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="session-meta">
                    {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                    {s.perceived_effort && <span>Effort: {s.perceived_effort}/10</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No training sessions yet. Start your first workout!</p>
          )}
        </div>
      </div>
    </div>
  );
}
