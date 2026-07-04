import { useState } from 'react';
import { useTraining } from '../hooks/useTraining';
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
      setFormError('Program name is required');
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
      setFormError(err.response?.data?.error || 'Failed to create program');
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
    if (!confirm('Delete this training program? This cannot be undone.')) return;
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
      setFormError(err.response?.data?.error || 'Failed to add exercise');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: number) => {
    if (!programDetail || !confirm('Remove this exercise?')) return;
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
      setFormError(err.response?.data?.error || 'Failed to log session');
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

  if (loading) return <div className="page-loading">Loading training programs...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="training-page">
      <div className="page-header">
        <h1>Training Programs</h1>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadSessions}>
            Session History
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateProgram(true)}>
            + New Program
          </button>
          <button className="btn btn-outline" onClick={() => setShowLogSession(true)}>
            📋 Log Workout
          </button>
        </div>
      </div>

      {/* Programs Grid */}
      {programs.length === 0 ? (
        <div className="empty-state">
          <p>No training programs yet.</p>
          <p className="text-muted">Create your first program to get started!</p>
        </div>
      ) : (
        <div className="programs-grid">
          {programs.map(prog => (
            <div key={prog.id} className="program-card">
              <div className="program-card-header">
                <h3>{prog.name}</h3>
                <span className={`badge badge-${prog.difficulty}`}>{prog.difficulty}</span>
              </div>
              {prog.description && <p className="text-muted">{prog.description}</p>}
              {prog.target_muscle_group && (
                <p className="text-muted">Target: {prog.target_muscle_group}</p>
              )}
              <div className="program-card-actions">
                <button className="btn btn-outline btn-sm" onClick={() => handleViewProgram(prog.id)}>
                  View Exercises
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setSessionProgramId(prog.id);
                  setShowLogSession(true);
                }}>
                  Log Session
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProgram(prog.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <span className="badge">Difficulty: {programDetail.difficulty}</span>
                {programDetail.target_muscle_group && (
                  <span className="badge">Target: {programDetail.target_muscle_group}</span>
                )}
              </div>

              <h3>Exercises</h3>
              {programDetail.exercises && programDetail.exercises.length > 0 ? (
                <div className="exercise-list">
                  {programDetail.exercises.map((ex: Exercise) => (
                    <div key={ex.id} className="exercise-item">
                      <div className="exercise-info">
                        <strong>{ex.name}</strong>
                        <span>{ex.sets} sets × {ex.reps} reps</span>
                        {ex.weight_kg && <span>{ex.weight_kg} kg</span>}
                        <span>Rest: {ex.rest_seconds}s</span>
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
                <p className="text-muted">No exercises added yet.</p>
              )}

              <button
                className="btn btn-outline btn-full"
                onClick={() => setShowAddExercise(!showAddExercise)}
              >
                {showAddExercise ? 'Cancel' : '+ Add Exercise'}
              </button>

              {showAddExercise && (
                <div className="exercise-form">
                  <input
                    type="text"
                    placeholder="Exercise name"
                    value={exName}
                    onChange={e => setExName(e.target.value)}
                  />
                  <div className="form-row">
                    <div className="form-group">
                      <label>Sets</label>
                      <input type="number" value={exSets} onChange={e => setExSets(Number(e.target.value))} min={1} />
                    </div>
                    <div className="form-group">
                      <label>Reps</label>
                      <input type="number" value={exReps} onChange={e => setExReps(Number(e.target.value))} min={1} />
                    </div>
                    <div className="form-group">
                      <label>Weight (kg)</label>
                      <input type="number" value={exWeight ?? ''} onChange={e => setExWeight(e.target.value ? Number(e.target.value) : undefined)} step="0.5" />
                    </div>
                    <div className="form-group">
                      <label>Rest (s)</label>
                      <input type="number" value={exRest} onChange={e => setExRest(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleAddExercise} disabled={saving}>
                    {saving ? 'Adding...' : 'Add Exercise'}
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
              <h2>Create Training Program</h2>
              <button className="btn-close" onClick={() => { setShowCreateProgram(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="form-group">
                <label>Program Name *</label>
                <input type="text" value={progName} onChange={e => setProgName(e.target.value)} placeholder="e.g. Push Day" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={progDesc} onChange={e => setProgDesc(e.target.value)} placeholder="Brief description of the program..." rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Difficulty</label>
                  <select value={progDifficulty} onChange={e => setProgDifficulty(e.target.value)}>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Muscle Group</label>
                  <input type="text" value={progMuscle} onChange={e => setProgMuscle(e.target.value)} placeholder="e.g. Chest, Back, Legs" />
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleCreateProgram} disabled={saving}>
                {saving ? 'Creating...' : 'Create Program'}
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
              <h2>Log Workout Session</h2>
              <button className="btn-close" onClick={() => { setShowLogSession(false); resetSessionForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="form-group">
                <label>Program (optional)</label>
                <select value={sessionProgramId ?? ''} onChange={e => setSessionProgramId(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">Freestyle workout</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input type="number" value={sessionDuration ?? ''} onChange={e => setSessionDuration(e.target.value ? Number(e.target.value) : undefined)} min={1} placeholder="45" />
                </div>
                <div className="form-group">
                  <label>Perceived Effort (1-10)</label>
                  <input type="number" value={sessionEffort ?? ''} onChange={e => setSessionEffort(e.target.value ? Number(e.target.value) : undefined)} min={1} max={10} placeholder="7" />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="How did it go? Any PRs?" rows={3} />
              </div>
              <button className="btn btn-primary btn-full" onClick={handleLogSession} disabled={saving}>
                {saving ? 'Saving...' : 'Log Session'}
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
              <h2>Session History</h2>
              <button className="btn-close" onClick={() => setShowSessions(false)}>✕</button>
            </div>
            <div className="modal-body">
              {sessions.length === 0 ? (
                <p className="text-muted">No sessions recorded yet.</p>
              ) : (
                <div className="session-list">
                  {sessions.map((s: any) => (
                    <div key={s.id} className="session-item">
                      <div className="session-info">
                        <span className="session-name">{s.program_name || 'Freestyle Workout'}</span>
                        <span className="session-date">{new Date(s.started_at).toLocaleDateString()}</span>
                      </div>
                      <div className="session-meta">
                        {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                        {s.perceived_effort && <span>Effort: {s.perceived_effort}/10</span>}
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
