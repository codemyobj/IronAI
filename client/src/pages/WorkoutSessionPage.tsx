import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHeader } from '../context/HeaderContext';
import apiClient from '../api';
import type { TrainingProgram, Exercise } from '../types';

// --- 数据结构 ---
interface SetData {
  setIndex: number;
  weight: string;
  reps: string;
  done: boolean;
}

interface ExerciseState {
  exercise: Exercise;
  sets: SetData[];
}

type TabFilter = 'all' | 'done' | 'remaining';

// --- 工具函数 ---
function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutSessionPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setHeader } = useHeader();

  // --- 状态 ---
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState(0);
  const [tab, setTab] = useState<TabFilter>('all');
  const [restCountdown, setRestCountdown] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // --- 计时器 ---
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [paused]);

  // --- 休息倒计时 ---
  useEffect(() => {
    if (restCountdown <= 0) return;
    const timer = setInterval(() => {
      setRestCountdown(r => {
        if (r <= 1) { return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restCountdown]);

  // --- 加载计划 ---
  useEffect(() => {
    if (!programId) return;
    setLoading(true);
    apiClient.get(`/training/programs/${programId}`)
      .then(res => {
        const prog: TrainingProgram = res.data.program;
        setProgram(prog);
        setExercises(
          (prog.exercises || []).map(ex => ({
            exercise: ex,
            sets: Array.from({ length: ex.sets }, (_, i) => ({
              setIndex: i + 1,
              weight: ex.weight_kg ? String(ex.weight_kg) : '',
              reps: ex.reps ? String(ex.reps) : '',
              done: false,
            })),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [programId]);

  // --- Header ---
  useEffect(() => {
    setHeader({ title: t('workout.title') });
  }, [setHeader, t]);

  // --- 计算汇总 ---
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const doneSets = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.done).length, 0,
  );
  const doneExercises = exercises.filter(
    ex => ex.sets.every(s => s.done),
  ).length;
  // 估算卡路里：每完成一组约 15 kcal
  const kcalEstimate = doneSets * 15;

  // --- 切换 set 完成状态 ---
  const toggleSet = useCallback((exIdx: number, setIdx: number) => {
    setExercises(prev => {
      const next = [...prev];
      const set = next[exIdx].sets[setIdx];
      const wasDone = set.done;
      next[exIdx] = {
        ...next[exIdx],
        sets: next[exIdx].sets.map(s =>
          s.setIndex === set.setIndex ? { ...s, done: !wasDone } : s,
        ),
      };
      return next;
    });

    // 如果当前 set 被勾选为完成，启动休息倒计时
    const ex = exercises[exIdx];
    if (ex) {
      const set = ex.sets[setIdx];
      if (set && !set.done) {
        const restSec = ex.exercise.rest_seconds || 60;
        setRestCountdown(restSec);
      }
    }

    // 如果当前动作所有 set 完成，移动到下一个动作
    const updatedEx = exercises[exIdx];
    if (updatedEx) {
      const allDone = updatedEx.sets.every(s =>
        s.setIndex === updatedEx.sets[setIdx].setIndex ? true : s.done,
      );
      if (allDone && exIdx < exercises.length - 1) {
        setActiveExerciseIdx(exIdx + 1);
      }
    }
  }, [exercises]);

  // --- 更新输入值 ---
  const updateSetInput = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setExercises(prev => {
      const next = [...prev];
      next[exIdx] = {
        ...next[exIdx],
        sets: next[exIdx].sets.map(s =>
          s.setIndex === setIdx + 1 ? { ...s, [field]: value } : s,
        ),
      };
      return next;
    });
  };

  // --- 完成/结束训练 ---
  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await apiClient.post('/training/sessions', {
        program_id: Number(programId),
        duration_minutes: Math.max(1, Math.round(elapsed / 60)),
        perceived_effort: 7,
        notes: `完成 ${doneSets}/${totalSets} 组，${doneExercises}/${exercises.length} 个动作`,
      });
    } catch {
      // 静默失败，仍然跳转
    }
    navigate('/training');
  };

  // --- 过滤显示 ---
  const filteredExercises = exercises.map((ex, idx) => ({
    ...ex,
    originalIdx: idx,
  })).filter(item => {
    if (tab === 'all') return true;
    if (tab === 'done') return item.sets.every(s => s.done);
    if (tab === 'remaining') return !item.sets.every(s => s.done);
    return true;
  });

  // --- FAB：下一组/跳过 ---
  const handleFabClick = () => {
    // 找到当前活跃动作中第一个未完成的 set
    const activeEx = exercises[activeExerciseIdx];
    if (!activeEx) return;
    const nextSetIdx = activeEx.sets.findIndex(s => !s.done);
    if (nextSetIdx !== -1) {
      toggleSet(activeExerciseIdx, nextSetIdx);
    } else if (activeExerciseIdx < exercises.length - 1) {
      // 当前动作全部完成 → 切到下一个
      setActiveExerciseIdx(activeExerciseIdx + 1);
    } else {
      // 全部完成 → 结束训练
      handleFinish();
    }
  };

  // --- 渲染 ---
  if (loading) {
    return (
      <div className="workout-session-page">
        <div className="workout-loading">{t('workout.loading')}</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="workout-session-page">
        <div className="alert alert-error">{t('workout.notFound')}</div>
        <button className="btn btn-outline" onClick={() => navigate('/training')}>
          ← {t('workout.backToTraining')}
        </button>
      </div>
    );
  }

  return (
    <div className="workout-session-page">
      {/* Mini header */}
      <div className="mini-header">
        <div>
          <h2>{program.name}</h2>
          <div className="subtitle">
            {program.target_muscle_group || t('training.generalMuscle')} · {t('workout.inProgress')}
          </div>
        </div>
        <div className="right-wrap">
          <button className="chip-btn" onClick={() => setPaused(p => !p)}>
            {paused ? t('workout.resume') : `⏸ ${t('workout.pause')}`}
          </button>
        </div>
      </div>

      {/* Timer hero */}
      <div className="workout-timer-card">
        <div className="workout-timer-label">{t('workout.duration')}</div>
        <div className="workout-timer-value">{formatTime(elapsed)}</div>
        <div className="workout-timer-meta">
          <span className="workout-timer-chip">🔥 {kcalEstimate} kcal</span>
          <span className="workout-timer-chip">💪 {doneExercises} / {exercises.length} {t('workout.exercisesUnit')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div className="tabs">
          <div
            className={`tabs-pill ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            {t('workout.tabAll')}
          </div>
          <div
            className={`tabs-pill ${tab === 'done' ? 'active' : ''}`}
            onClick={() => setTab('done')}
          >
            {t('workout.tabDone')}
          </div>
          <div
            className={`tabs-pill ${tab === 'remaining' ? 'active' : ''}`}
            onClick={() => setTab('remaining')}
          >
            {t('workout.tabRemaining')}
          </div>
        </div>
      </div>

      {/* Exercise cards */}
      {filteredExercises.length === 0 ? (
        <div className="empty-state">
          <p>{t('workout.noExercises')}</p>
        </div>
      ) : (
        filteredExercises.map((item) => {
          const exIdx = item.originalIdx;
          const isActive = exIdx === activeExerciseIdx;
          const allDone = item.sets.every(s => s.done);
          return (
            <div key={item.exercise.id} className={`exercise-card ${isActive && !allDone ? 'active' : ''}`}>
              <div className="exercise-head">
                <div className="exercise-name">
                  {exIdx + 1}. {item.exercise.name}
                </div>
                <span className="exercise-sets">
                  {allDone
                    ? `${item.sets.length} ${t('workout.setsUnit')} ✓`
                    : `${item.sets.filter(s => s.done).length} / ${item.sets.length}`}
                </span>
              </div>

              {item.sets.map((set, setIdx) => {
                const showRestDivider =
                  set.done && setIdx < item.sets.length - 1 && restCountdown > 0 && isActive;
                return (
                  <div key={set.setIndex}>
                    <div className={`set-grid ${set.done ? 'done' : ''}`}>
                      <div className="h"></div>
                      <div className="h">SET</div>
                      <div className="h">KG</div>
                      <div className="h">REPS</div>
                      <div
                        className="set-check"
                        onClick={() => toggleSet(exIdx, setIdx)}
                      >
                        ✓
                      </div>
                      <div>{set.setIndex}</div>
                      <input
                        value={set.weight}
                        placeholder="kg"
                        onChange={e => updateSetInput(exIdx, setIdx, 'weight', e.target.value)}
                      />
                      <input
                        value={set.reps}
                        placeholder={t('workout.repsPlaceholder')}
                        onChange={e => updateSetInput(exIdx, setIdx, 'reps', e.target.value)}
                      />
                    </div>
                    {showRestDivider && (
                      <div className="workout-rest-chip">
                        <span>⏱ {t('workout.rest')}</span>
                        <span className="rest-countdown">{formatTime(restCountdown)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Bottom actions */}
      <div className="workout-bottom-actions">
        <button className="btn btn-outline" onClick={() => navigate('/training')}>
          ← {t('workout.back')}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleFinish}
          disabled={finishing}
        >
          {finishing ? t('workout.finishing') : `✓ ${t('workout.finish')}`}
        </button>
      </div>

      {/* FAB */}
      <div
        className="workout-fab"
        title={t('workout.nextSet')}
        onClick={handleFabClick}
      >
        ⏭
      </div>
    </div>
  );
}
