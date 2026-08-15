import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTraining } from '../hooks/useTraining';
import { useHeader } from '../context/HeaderContext';
import { ChartCard, TrainingBarChart, MuscleGroupChart } from '../components/Charts';
import { TrainingSkeleton } from '../components/Skeleton';
import type { TrainingProgram, Exercise } from '../types';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export default function TrainingPage() {
  const {
    programs,
    loading,
    error,
    fetchProgram,
    createProgram,
    deleteProgram,
    addExercise,
    deleteExercise,
    logSession,
  } = useTraining();

  const { t } = useTranslation();
  const { setHeader, setPageLoading } = useHeader();

  // Modal states
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [showLogSession, setShowLogSession] = useState(false);
  const [programDetail, setProgramDetail] = useState<TrainingProgram | null>(null);

  // Form states
  const [progName, setProgName] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [progDifficulty, setProgDifficulty] = useState<string>('beginner');
  const [progMuscle, setProgMuscle] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Log session form
  const [sessionProgramId, setSessionProgramId] = useState<number | undefined>();
  const [sessionDuration, setSessionDuration] = useState<number | undefined>();
  const [sessionEffort, setSessionEffort] = useState<number | undefined>();
  const [sessionNotes, setSessionNotes] = useState('');

  // Exercise form
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState(10);
  const [exWeight, setExWeight] = useState<number | undefined>();
  const [exRest, setExRest] = useState(60);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [showSessions, setShowSessions] = useState(false);

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
    if (program) {
      setProgramDetail(program);
    }
  };

  const handleDeleteProgram = async (id: number) => {
    if (!confirm(t('common.confirmDeleteProgram'))) return;
    try {
      await deleteProgram(id);
      if (programDetail?.id === id) setProgramDetail(null);
    } catch {
      // error handled by hook
    }
  };

  const handleAddExercise = async () => {
    if (!programDetail || !exName.trim()) return;
    setSaving(true);
    try {
      await addExercise(programDetail.id, {
        name: exName,
        sets: exSets,
        reps: exReps,
        weight_kg: exWeight,
        rest_seconds: exRest,
      });
      // Refresh the program detail to get updated exercises
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
    } catch {
      // error handled by hook
    }
  };

  const handleLogSession = async () => {
    setFormError('');
    setSaving(true);
    try {
      await logSession({
        program_id: sessionProgramId,
        duration_minutes: sessionDuration,
        perceived_effort: sessionEffort,
        notes: sessionNotes || undefined,
      });
      setShowLogSession(false);
      resetSessionForm();
    } catch (err: any) {
      setFormError(err.response?.data?.error || t('common.logSessionFailed'));
    } finally {
      setSaving(false);
    }
  };

  const loadSessions = async () => {
    try {
      const { default: apiClient } = await import('../api');
      const res = await apiClient.get('/training/sessions', { params: { limit: 20 } });
      setSessions(res.data.sessions);
      setShowSessions(true);
    } catch {
      // ignore
    }
  };

  function resetForm() {
    setProgName('');
    setProgDesc('');
    setProgDifficulty('beginner');
    setProgMuscle('');
    setFormError('');
  }

  function resetSessionForm() {
    setSessionProgramId(undefined);
    setSessionDuration(undefined);
    setSessionEffort(undefined);
    setSessionNotes('');
    setFormError('');
  }

  useEffect(() => {
    setHeader({
      title: t('training.title'),
    });
  }, [t, setHeader]);

  useEffect(() => {
    setPageLoading(loading);
    return () => setPageLoading(false);
  }, [loading, setPageLoading]);

  if (loading) return <TrainingSkeleton />;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="training-page">
      <div className="page-actions">
        <button className="btn btn-outline" onClick={loadSessions}>
          {t('training.sessionHistory')}
        </button>
        <button className="btn btn-primary" onClick={() => setShowCreateProgram(true)}>
          {t('training.newProgram')}
        </button>
        <button className="btn btn-outline" onClick={() => setShowLogSession(true)}>
          {t('training.logWorkout')}
        </button>
      </div>

      {/* Programs Grid */}
      {programs.length === 0 ? (
        <div className="empty-state">
          <p>{t('training.noProgramsTitle')}</p>
          <p className="text-muted">{t('training.noPrograms')}</p>
        </div>
      ) : (
        <div className="programs-grid">
          {programs.map(prog => (
            <div key={prog.id} className="program-card">
              <div className="program-card-header">
                <h3>{prog.name}</h3>
                <span className={`badge badge-${prog.difficulty}`}>{t(`training.${prog.difficulty}`)}</span>
              </div>
              {prog.description && <p className="text-muted">{prog.description}</p>}
              {prog.target_muscle_group && (
                <p className="text-muted">{`${t('training.targetMuscle')}: ${prog.target_muscle_group}`}</p>
              )}
              <div className="program-card-actions">
                <button className="btn btn-outline btn-sm" onClick={() => handleViewProgram(prog.id)}>
                  {t('training.viewExercises')}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setSessionProgramId(prog.id);
                  setShowLogSession(true);
                }}>
                  {t('training.logSession')}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProgram(prog.id)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        {sessions.length > 0 && (
          <ChartCard title={t('training.durationTrend')}>
            <TrainingBarChart
              data={sessions.slice(0, 10).reverse().map((s: any) => ({
                label: new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                value: s.duration_minutes || 0,
              }))}
              color="#8b5cf6"
            />
          </ChartCard>
        )}
        {programs.length > 0 && (() => {
          const groupMap: Record<string, number> = {}
          programs.forEach(p => {
            const g = p.target_muscle_group || 'Other'
            groupMap[g] = (groupMap[g] || 0) + 1
          })
          const data = Object.entries(groupMap).map(([label, value]) => ({ label, value }))
          return (
            <ChartCard title={t('training.muscleGroupDistribution')}>
              <MuscleGroupChart data={data} />
            </ChartCard>
          )
        })()}
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
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteExercise(ex.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">{t('training.noExercisesAdded')}</p>
              )}

              <button
                className="btn btn-outline btn-full"
                onClick={() => setShowAddExercise(!showAddExercise)}
              >
                {showAddExercise ? t('training.cancel') : t('training.addExercise')}
              </button>

              {showAddExercise && (
                <div className="exercise-form">
                  <input
                    type="text"
                    placeholder={t('training.exerciseName')}
                    value={exName}
                    onChange={e => setExName(e.target.value)}
                  />
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
                <textarea value={progDesc} onChange={e => setProgDesc(e.target.value)} placeholder="Brief description of the program..." rows={3} />
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
                  <input type="text" value={progMuscle} onChange={e => setProgMuscle(e.target.value)} placeholder="e.g. Chest, Back, Legs" />
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleCreateProgram} disabled={saving}>
                {saving ? t('training.creating') : t('training.createProgram')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Session Modal */}
      {showLogSession && (
        <div className="modal-overlay" onClick={() => { setShowLogSession(false); resetSessionForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('training.logWorkoutTitle')}</h2>
              <button className="btn-close" onClick={() => { setShowLogSession(false); resetSessionForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="form-group">
                <label>{t('training.programOptional')}</label>
                <select value={sessionProgramId ?? ''} onChange={e => setSessionProgramId(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">{t('common.freestyleWorkout')}</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('training.duration')}</label>
                  <input type="number" value={sessionDuration ?? ''} onChange={e => setSessionDuration(e.target.value ? Number(e.target.value) : undefined)} min={1} placeholder="45" />
                </div>
                <div className="form-group">
                  <label>{t('training.perceivedEffort')}</label>
                  <input type="number" value={sessionEffort ?? ''} onChange={e => setSessionEffort(e.target.value ? Number(e.target.value) : undefined)} min={1} max={10} placeholder="7" />
                </div>
              </div>
              <div className="form-group">
                <label>{t('training.notes')}</label>
                <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="How did it go? Any PRs?" rows={3} />
              </div>
              <button className="btn btn-primary btn-full" onClick={handleLogSession} disabled={saving}>
                {saving ? t('training.saving') : t('training.logSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions History Modal */}
      {showSessions && (
        <div className="modal-overlay" onClick={() => setShowSessions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('training.sessionHistoryTitle')}</h2>
              <button className="btn-close" onClick={() => setShowSessions(false)}>✕</button>
            </div>
            <div className="modal-body">
              {sessions.length === 0 ? (
                <p className="text-muted">{t('training.noSessions')}</p>
              ) : (
                <div className="session-list">
                  {sessions.map((s: any) => (
                    <div key={s.id} className="session-item">
                      <div className="session-info">
                        <span className="session-name">{s.program_name || t('common.freestyleWorkout')}</span>
                        <span className="session-date">{new Date(s.started_at).toLocaleDateString()}</span>
                      </div>
                      <div className="session-meta">
                        {s.duration_minutes && <span>{`${s.duration_minutes} ${t('common.min')}`}</span>}
                        {s.perceived_effort && <span>{t('common.effort', { value: s.perceived_effort })}</span>}
                      </div>
                      {s.notes && <p className="text-muted">{s.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
