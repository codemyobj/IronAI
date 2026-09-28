import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTraining } from '../hooks/useTraining';
import { useHeader } from '../context/HeaderContext';
import { TrainingSkeleton } from '../components/Skeleton';
import type { TrainingProgram, Exercise } from '../types';
import apiClient from '../api';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const WEEKLY_GOAL = 6;
const MUSCLE_COLORS = ['var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)', 'var(--chart-series-4)'];

type AIState = 'idle' | 'loading' | 'result' | 'error';

interface AIAnalysis {
  id: number;
  user_id: number;
  analysis_type: 'training' | 'diet';
  response_text: string;
  created_at: string;
}

interface SessionRecord {
  id: number;
  program_id: number | null;
  program_name: string | null;
  started_at: string;
  duration_minutes: number | null;
  perceived_effort: number | null;
  notes: string | null;
}

export default function TrainingPage() {
  const navigate = useNavigate();
  const {
    programs,
    loading,
    error,
    fetchProgram,
    createProgram,
    deleteProgram,
    addExercise,
    deleteExercise,
  } = useTraining();

  const { t } = useTranslation();
  const { setHeader, setPageLoading } = useHeader();

  // Modal states
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [programDetail, setProgramDetail] = useState<TrainingProgram | null>(null);

  // Form states
  const [progName, setProgName] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [progDifficulty, setProgDifficulty] = useState<string>('beginner');
  const [progMuscle, setProgMuscle] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Exercise form
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState(10);
  const [exWeight, setExWeight] = useState<number | undefined>();
  const [exRest, setExRest] = useState(60);

  // Sessions state
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // AI state
  const [aiState, setAiState] = useState<AIState>('idle');
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string>('');

  // 加载训练记录（用于 duration chart）
  useEffect(() => {
    apiClient.get('/training/sessions', { params: { limit: 30 } })
      .then(res => setSessions(res.data.sessions || []))
      .catch(() => {});
  }, []);

  // 本周训练数据
  const weekData = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    const dayDurations = days.map(d => {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const daySessions = sessions.filter(s => {
        const sd = new Date(s.started_at);
        return sd >= dayStart && sd <= dayEnd;
      });
      const totalDur = daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      return { date: d, duration: totalDur, count: daySessions.length };
    });

    const weekSessions = sessions.filter(s => new Date(s.started_at) >= weekStart);
    const totalMin = weekSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const avg = weekSessions.length > 0 ? Math.round(totalMin / weekSessions.length) : 0;

    return { dayDurations, weekCount: weekSessions.length, avg, totalMin };
  }, [sessions]);

  // 肌群分布
  const muscleData = useMemo(() => {
    const groupMap: Record<string, number> = {};
    sessions.forEach(s => {
      const prog = programs.find(p => p.id === s.program_id);
      const g = prog?.target_muscle_group || 'Other';
      groupMap[g] = (groupMap[g] || 0) + 1;
    });
    // 如果没有 session 数据，用 programs 数据
    if (Object.keys(groupMap).length === 0) {
      programs.forEach(p => {
        const g = p.target_muscle_group || 'Other';
        groupMap[g] = (groupMap[g] || 0) + 1;
      });
    }
    const total = Object.values(groupMap).reduce((a, b) => a + b, 0);
    return Object.entries(groupMap)
      .map(([label, value]) => ({ label, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [sessions, programs]);

  const handleCreateProgram = async () => {
    setFormError('');
    if (!progName.trim()) {
      setFormError(t('common.programNameRequired'));
      return;
    }
    setSaving(true);
    try {
      await createProgram({
        name: progName,
        description: progDesc || undefined,
        difficulty: progDifficulty,
        target_muscle_group: progMuscle || undefined,
      });
      setShowCreateProgram(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.response?.data?.error || t('common.createProgramFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleViewProgram = async (id: number) => {
    const program = await fetchProgram(id);
    if (program) setProgramDetail(program);
  };

  const handleDeleteProgram = async (id: number) => {
    if (!confirm(t('common.confirmDeleteProgram'))) return;
    try {
      await deleteProgram(id);
      if (programDetail?.id === id) setProgramDetail(null);
    } catch {}
  };

  const handleAddExercise = async () => {
    if (!programDetail || !exName.trim()) return;
    setSaving(true);
    try {
      await addExercise(programDetail.id, {
        name: exName, sets: exSets, reps: exReps, weight_kg: exWeight, rest_seconds: exRest,
      });
      const updated = await fetchProgram(programDetail.id);
      if (updated) setProgramDetail(updated);
      setShowAddExercise(false);
      setExName('');
    } catch (err: any) {
      setFormError(err.response?.data?.error || t('common.addExerciseFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: number) => {
    if (!programDetail || !confirm(t('common.confirmDeleteExercise'))) return;
    try {
      await deleteExercise(exerciseId);
      const updated = await fetchProgram(programDetail.id);
      if (updated) setProgramDetail(updated);
    } catch {}
  };

  function resetForm() {
    setProgName(''); setProgDesc(''); setProgDifficulty('beginner'); setProgMuscle(''); setFormError('');
  }

  useEffect(() => {
    setHeader({ title: t('training.title') });
  }, [t, setHeader]);

  useEffect(() => {
    setPageLoading(loading);
    return () => setPageLoading(false);
  }, [loading, setPageLoading]);

  const handleAiAnalyze = async () => {
    setAiError('');
    setAiResult(null);
    setAiState('loading');

    // 后端接口：POST /api/ai/training-analysis
    // 返回：{ analysis, generatedAt }
    try {
      const res = await apiClient.post('/ai/training-analysis');
      const text =
        res.data?.analysis ||
        res.data?.response_text ||
        res.data?.result ||
        '';

      const normalized: AIAnalysis = {
        id: res.data?.id ?? 0,
        user_id: res.data?.user_id ?? 0,
        analysis_type: 'training',
        response_text: String(text),
        created_at: res.data?.generatedAt || new Date().toISOString(),
      };
      setAiResult(normalized);
      setAiState('result');
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;
      const raw: string = err?.response?.data?.error || '';

      // 优先级：1) 后端 toPublic() 精确错误  2) axios message  3) i18n 兜底
      let message: string = raw || (typeof err?.message === 'string' ? err.message : '') || t('ai.analysisFailed');
      if (!raw && (status === 502 || status === 503)) message = t('ai.serviceUnavailable');

      const isOffline = (status == null) || String(message).toLowerCase().includes('network error');

      if (isOffline) {
        // 离线/后端挂了 → 保持原有的 setTimeout 演示效果，避免"点了没反应"
        await new Promise(r => setTimeout(r, 2000));
        const fallback: AIAnalysis = {
          id: 0,
          user_id: 0,
          analysis_type: 'training',
          response_text: `${t('training.aiResult1')}\n${t('training.aiResult2')}\n${t('training.aiResult3')}`,
          created_at: new Date().toISOString(),
        };
        setAiResult(fallback);
        setAiState('result');
      } else {
        setAiError(message);
        setAiState('error');
      }
    }
  };

  // 标题首字母大写工具函数：push day → Push Day
  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

  // 计算每个 program 的进度（基于 sessions）
  const getProgramProgress = (prog: TrainingProgram) => {
    const progSessions = sessions.filter(s => s.program_id === prog.id);
    const lastSession = progSessions[0];
    const exerciseCount = prog.exercises?.length || 0;
    // 进度 = 本周完成次数 / 目标次数
    const weekCount = progSessions.filter(s => {
      const d = new Date(s.started_at);
      return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).length;
    const pct = Math.min(Math.round((weekCount / 3) * 100), 100);
    return { lastSession, exerciseCount, weekCount, pct };
  };

  if (loading) return <TrainingSkeleton />;
  if (error) return <div className="alert alert-error">{error}</div>;

  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxDuration = Math.max(...weekData.dayDurations.map(d => d.duration), 60);
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  return (
    <div className="training-page">
      {/* Header with weekly progress + New 按钮 */}
      <div className="training-header-row">
        <div className="training-header-info">
          <h2>{t('training.weeklyProgress')}</h2>
          <div className="training-header-sub">
            {t('training.weeklyCount', { done: weekData.weekCount, goal: WEEKLY_GOAL })}
          </div>
        </div>
        <button className="chip-btn primary" onClick={() => setShowCreateProgram(true)}>
          {t('training.newProgram')}
        </button>
      </div>

      {/* Duration Chart */}
      <div className="chart-card">
        <div className="chart-card-head">
          <div className="chart-title">{t('training.durationTrend')}</div>
          <div className="chart-sub">{t('training.durationAvg', { avg: weekData.avg })}</div>
        </div>
        <div className="duration-chart">
          {weekData.dayDurations.map((d, i) => {
            const h = d.duration > 0 ? Math.max((d.duration / maxDuration) * 100, 8) : 0;
            return (
              <div
                key={i}
                className={`duration-bar ${i === todayIdx && d.duration > 0 ? 'hl' : ''} ${d.duration === 0 ? 'empty' : ''}`}
                style={{ height: `${h}%` }}
                title={`${d.date.toLocaleDateString()} · ${d.duration} min`}
              />
            );
          })}
        </div>
        <div className="duration-labels">
          {weekdays.map((d, i) => <span key={i}>{d}</span>)}
        </div>
      </div>

      {/* Program Cards with progress */}
      <div className="dashboard-section">
        {programs.length === 0 ? (
          <div className="empty-state">
            <p>{t('training.noProgramsTitle')}</p>
            <p className="text-muted">{t('training.noPrograms')}</p>
          </div>
        ) : (
          <div className="programs-grid">
            {programs.map(prog => {
              const { lastSession, exerciseCount, pct } = getProgramProgress(prog);
              const isLow = pct < 34;
              const relTime = lastSession
                ? (() => {
                    const diffH = Math.floor((Date.now() - new Date(lastSession.started_at).getTime()) / 3600000);
                    const diffD = Math.floor(diffH / 24);
                    return diffD > 0 ? t('training.daysAgo', { count: diffD }) : diffH > 0 ? t('training.hoursAgo', { count: diffH }) : t('training.justNow');
                  })()
                : t('training.never');
              return (
                <div key={prog.id} className="program-card-prog" onClick={() => handleViewProgram(prog.id)}>
                  <div className="pc-header">
                    <h3>{toTitleCase(prog.name)}</h3>
                    <span className={`badge badge-${prog.difficulty}`}>{t(`training.${prog.difficulty}`)}</span>
                  </div>
                  <div className="pc-meta">
                    {prog.target_muscle_group || t('training.generalMuscle')} · {exerciseCount === 0 ? t('training.noExercisesYet') : `${exerciseCount} ${t('training.exercisesUnit')}`}
                  </div>
                  <div className="pc-tags">
                    <span className="badge badge-primary">{t('training.minPerSession', { min: 45 })}</span>
                    <span className="badge badge-secondary">{t('training.setsRepsShort', { sets: 3, reps: 10 })}</span>
                  </div>
                  <div className="pc-progress">
                    <div
                      className={`pc-progress-fill ${isLow ? 'warn' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="pc-footer">
                    <span className="pc-last">{t('training.lastSession')}: {relTime}</span>
                    <span className={`pc-pct ${isLow ? 'warn' : ''}`}>{pct}% →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Muscle Group Donut */}
      {muscleData.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-title">{t('training.muscleDistribution')}</div>
            <div className="chart-sub">{t('training.thisMonth')}</div>
          </div>
          <div className="muscle-donut-wrap">
            <div
              className="muscle-donut"
              style={{
                background: `conic-gradient(${
                  muscleData.map((m, i) => `${MUSCLE_COLORS[i % MUSCLE_COLORS.length]} 0% ${m.pct}%`).join(', ')
                })`,
              }}
            >
              <div className="muscle-donut-inner">
                {muscleData.reduce((a, m) => a + m.value, 0)}{t('training.timesUnit')}
              </div>
            </div>
            <div className="muscle-legend">
              {muscleData.map((m, i) => (
                <div key={i} className="muscle-legend-item">
                  <span className="muscle-legend-dot" style={{ background: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }} />
                  {m.label} {m.pct}%
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI 训练分析区块 */}
      <div className="ai-section">
        <h3>{t('training.aiAnalysisTitle')}</h3>
        <p className="ai-desc">{t('training.aiAnalysisDesc')}</p>

        <div className={`ai-state ${aiState === 'idle' ? 'active' : ''}`}>
          <button className="ai-btn" onClick={handleAiAnalyze}>
            ⚡ {t('training.aiAnalyzeBtn')}
          </button>
        </div>
        <div className={`ai-state ${aiState === 'loading' ? 'active' : ''}`}>
          <div className="ai-loading">
            <div className="ai-spinner" />
            <p>{t('training.aiLoading')}</p>
            <span className="ai-hint">{t('training.aiLoadingHint')}</span>
          </div>
        </div>
        <div className={`ai-state ${aiState === 'error' ? 'active' : ''}`}>
          <div className="ai-error">
            <div className="alert alert-error">{aiError || t('ai.analysisFailed')}</div>
            <div className="ai-result-actions">
              <button className="ai-action-primary" onClick={handleAiAnalyze}>{t('training.aiReanalyze')}</button>
              <button onClick={() => { setAiError(''); setAiState('idle'); }}>{t('training.cancel')}</button>
            </div>
          </div>
        </div>
        <div className={`ai-state ${aiState === 'result' ? 'active' : ''}`}>
          <div className="ai-result">
            <h4>📊 {t('training.aiResultTitle')}</h4>
            {aiResult ? (
              <div className="ai-result-lines">
                {aiResult.response_text.split(/\n+/).filter(Boolean).map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            ) : (
              <ul>
                <li>{t('training.aiResult1')}</li>
                <li>{t('training.aiResult2')}</li>
                <li>{t('training.aiResult3')}</li>
              </ul>
            )}
            <div className="ai-result-actions">
              <button className="ai-action-primary">{t('training.aiViewPlan')}</button>
              <button onClick={handleAiAnalyze}>{t('training.aiReanalyze')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Program Detail Modal */}
      {programDetail && (
        <div className="modal-overlay" onClick={() => setProgramDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{programDetail.name}</h2>
              <button className="btn-close" onClick={() => setProgramDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              {programDetail.description && <p className="text-muted">{programDetail.description}</p>}
              <div className="meta-row">
                <span className="badge">{`${t('training.difficulty')}: ${t(`training.${programDetail.difficulty}`)}`}</span>
                {programDetail.target_muscle_group && (
                  <span className="badge">{`${t('training.targetMuscle')}: ${programDetail.target_muscle_group}`}</span>
                )}
              </div>

              {programDetail.exercises && programDetail.exercises.length > 0 && (
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginBottom: 'var(--space-4)' }}
                  onClick={() => {
                    setProgramDetail(null);
                    navigate(`/training/session/${programDetail.id}`);
                  }}
                >
                  ▶ {t('training.startWorkout')}
                </button>
              )}

              <h3>{t('training.exercises')}</h3>
              {programDetail.exercises && programDetail.exercises.length > 0 ? (
                <div className="exercise-list">
                  {programDetail.exercises.map((ex: Exercise) => (
                    <div key={ex.id} className="exercise-item">
                      <div className="exercise-info">
                        <strong>{ex.name}</strong>
                        <span>{t('training.setsReps', { sets: ex.sets, reps: ex.reps })}</span>
                        {ex.weight_kg && <span>{ex.weight_kg} kg</span>}
                        <span>{t('training.restLabel', { rest: ex.rest_seconds })}</span>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExercise(ex.id)}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">{t('training.noExercisesAdded')}</p>
              )}
              <button className="btn btn-outline btn-full" onClick={() => setShowAddExercise(!showAddExercise)}>
                {showAddExercise ? t('training.cancel') : t('training.addExercise')}
              </button>
              {showAddExercise && (
                <div className="exercise-form">
                  <input type="text" placeholder={t('training.exerciseName')} value={exName} onChange={e => setExName(e.target.value)} />
                  <div className="form-row">
                    <div className="form-group">
                      <label>{t('training.sets')}</label>
                      <input type="number" value={exSets} onChange={e => setExSets(Number(e.target.value))} min={1} />
                    </div>
                    <div className="form-group">
                      <label>{t('training.reps')}</label>
                      <input type="number" value={exReps} onChange={e => setExReps(Number(e.target.value))} min={1} />
                    </div>
                    <div className="form-group">
                      <label>{t('training.weight')}</label>
                      <input type="number" value={exWeight ?? ''} onChange={e => setExWeight(e.target.value ? Number(e.target.value) : undefined)} step="0.5" />
                    </div>
                    <div className="form-group">
                      <label>{t('training.rest')}</label>
                      <input type="number" value={exRest} onChange={e => setExRest(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleAddExercise} disabled={saving}>
                    {saving ? t('training.adding') : t('training.addExercise')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Program Modal */}
      {showCreateProgram && (
        <div className="modal-overlay" onClick={() => { setShowCreateProgram(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('training.createProgramTitle')}</h2>
              <button className="btn-close" onClick={() => { setShowCreateProgram(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}
              <div className="form-group">
                <label>{t('training.programName')} *</label>
                <input type="text" value={progName} onChange={e => setProgName(e.target.value)} placeholder="e.g. Push Day" />
              </div>
              <div className="form-group">
                <label>{t('training.description')}</label>
                <textarea value={progDesc} onChange={e => setProgDesc(e.target.value)} placeholder="Brief description..." rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('training.difficulty')}</label>
                  <select value={progDifficulty} onChange={e => setProgDifficulty(e.target.value)}>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{t(`training.${d}`)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('training.targetMuscle')}</label>
                  <input type="text" value={progMuscle} onChange={e => setProgMuscle(e.target.value)} placeholder="e.g. Chest, Back" />
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleCreateProgram} disabled={saving}>
                {saving ? t('training.creating') : t('training.createProgram')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
