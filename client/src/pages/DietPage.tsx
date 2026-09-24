import { useState, useEffect, useMemo } from 'react';
import { useDiet } from '../hooks/useDiet';
import { useTranslation } from 'react-i18next';
import { useHeader } from '../context/HeaderContext';
import { DietSkeleton } from '../components/Skeleton';
import apiClient from '../api';
import type { AIAnalysis } from '../types';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
};

const CALORIE_GOAL = 2000;

type AIState = 'idle' | 'loading' | 'result' | 'error';

function toTitleCase(s: string): string {
  return s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDateLabel(d: string, locale: string | undefined): string {
  const date = new Date(d + 'T00:00:00');
  if (locale && locale.startsWith('zh')) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export default function DietPage() {
  const {
    records,
    selectedDate,
    setSelectedDate,
    summary,
    loading,
    error,
    addRecord,
    deleteRecord,
  } = useDiet();

  const { t, i18n } = useTranslation();
  const { setHeader, setPageLoading } = useHeader();

  // Add food form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [mealType, setMealType] = useState<string>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();
  const [portion, setPortion] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // AI section state
  const [aiState, setAiState] = useState<AIState>('idle');
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiError, setAiError] = useState('');

  // Date navigation
  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const todayStr = new Date().toISOString().split('T')[0];

  // Today totals from records
  const todayTotals = useMemo(() =>
    records.reduce(
      (acc, r) => ({
        calories: acc.calories + Number(r.calories || 0),
        protein: acc.protein + Number(r.protein_grams || 0),
        carbs: acc.carbs + Number(r.carbs_grams || 0),
        fat: acc.fat + Number(r.fat_grams || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    ),
  [records]);

  // Calorie progress percentage
  const caloriePct = Math.min(100, Math.round((todayTotals.calories / CALORIE_GOAL) * 100));

  // Header config
  useEffect(() => {
    setHeader({
      title: t('diet.title'),
      subtitle: t('diet.intakeProgress', { pct: caloriePct }),
    });
  }, [t, setHeader, caloriePct]);

  // Page loading
  useEffect(() => {
    const isLoading = loading && records.length === 0;
    setPageLoading(isLoading);
    return () => setPageLoading(false);
  }, [loading, records.length, setPageLoading]);

  // Group records by meal type
  const groupedRecords = useMemo(() => {
    const g: Record<string, typeof records> = {};
    for (const r of records) {
      if (!g[r.meal_type]) g[r.meal_type] = [];
      g[r.meal_type].push(r);
    }
    return g;
  }, [records]);

  // Per-meal kcal totals
  const mealTotals = useMemo(() => {
    const t: Record<string, number> = {};
    MEAL_TYPES.forEach(m => {
      t[m] = (groupedRecords[m] || []).reduce((s, r) => s + Number(r.calories || 0), 0);
    });
    return t;
  }, [groupedRecords]);

  // Form handlers
  const resetForm = () => {
    setFoodName(''); setCalories(undefined); setProtein(undefined);
    setCarbs(undefined); setFat(undefined); setPortion('');
    setMealType('breakfast'); setFormError('');
  };

  const handleAddRecord = async () => {
    setFormError('');
    if (!foodName.trim()) { setFormError(t('common.foodNameRequired')); return; }
    setSaving(true);
    try {
      await addRecord({
        meal_type: mealType,
        food_name: foodName,
        calories,
        protein_grams: protein,
        carbs_grams: carbs,
        fat_grams: fat,
        portion_description: portion || undefined,
        recorded_at: selectedDate,
      });
      setShowAddForm(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.response?.data?.error || t('common.addFoodFailed'));
    } finally { setSaving(false); }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm(t('common.confirmDeleteFood'))) return;
    try { await deleteRecord(id); } catch { /* hook handles */ }
  };

  // AI diet analysis
  const handleAIAnalysis = async () => {
    // 立即清空上一次结果/错误并进入 loading，保证用户视觉上有明确反馈
    setAiError('');
    setAiResult(null);
    setAiState('loading');

    // 后端接口：POST /api/ai/diet-recommendation
    // 返回：{ recommendation, generatedAt }
    try {
      const res = await apiClient.post('/ai/diet-recommendation');
      const recommendation =
        res.data?.recommendation ||
        res.data?.analysis?.response_text ||
        res.data?.analysis ||
        '';

      // 封装成统一的 AIAnalysis 形状，供 aiPlanRows 解析
      const normalized: AIAnalysis = {
        id: res.data?.id ?? 0,
        user_id: res.data?.user_id ?? 0,
        analysis_type: 'diet',
        response_text: String(recommendation),
        created_at: res.data?.generatedAt || new Date().toISOString(),
      };
      setAiResult(normalized);
      setAiState('result');
    } catch (err: any) {
      // 后端未启动 / DeepSeek 未配置 / 网络错误时，降级显示 demo 结果
      const status: number | undefined = err?.response?.status;
      const raw: string = err?.response?.data?.error || '';

      // 优先级：1) 后端 toPublic() 精确错误  2) axios message  3) i18n 兜底
      // 仅当 502/503 没有后端说明时，才用 i18n 的"服务不可用"，避免把"key 无效"等精确提示覆盖掉。
      let message: string = raw || (typeof err?.message === 'string' ? err.message : '') || t('ai.analysisFailed');
      if (!raw && (status === 502 || status === 503)) message = t('ai.serviceUnavailable');

      const isOffline = (status == null) || String(message).toLowerCase().includes('network error');

      if (isOffline) {
        // 网络错误 / 后端离线 → demo fallback（与 TrainingPage 的 setTimeout 演示效果对齐）
        await new Promise(r => setTimeout(r, 1200));
        const fallback: AIAnalysis = {
          id: 0,
          user_id: 0,
          analysis_type: 'diet',
          response_text:
            'Day 1 · ' + t('ai.diet.demo.breakfast1') + ' · 420 kcal\n' +
            'Day 1 · ' + t('ai.diet.demo.lunch1') + ' · 560 kcal\n' +
            'Day 1 · ' + t('ai.diet.demo.dinner1') + ' · 480 kcal\n' +
            'Day 2 · ' + t('ai.diet.demo.breakfast2') + ' · 380 kcal',
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

  // Donut chart segments (CSS conic-gradient)
  const donutSegments = useMemo(() => {
    const total = todayTotals.protein + todayTotals.carbs + todayTotals.fat;
    if (total === 0) {
      return { grad: undefined, proteinPct: 0, carbsPct: 0, fatPct: 0 };
    }
    const pp = Math.round((todayTotals.protein / total) * 100);
    const cp = Math.round((todayTotals.carbs / total) * 100);
    const fp = 100 - pp - cp;
    const a = pp, b = pp + cp;
    const grad = `conic-gradient(var(--primary) 0% ${a}%, var(--secondary) ${a}% ${b}%, var(--accent-orange) ${b}% 100%)`;
    return { grad, proteinPct: pp, carbsPct: cp, fatPct: fp };
  }, [todayTotals.protein, todayTotals.carbs, todayTotals.fat]);

  // Parse AI plan rows from response_text (fallback demo rows if parsing fails)
  const aiPlanRows = useMemo(() => {
    if (!aiResult) return [];
    try {
      const lines = aiResult.response_text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && /^Day\s+\d/i.test(l))
        .slice(0, 6);
      if (lines.length > 0) {
        return lines.map(line => {
          const m = line.match(/^Day\s+(\d+)\s*[·.-]\s*(早|午|晚|早餐|午餐|晚餐|零食|Breakfast|Lunch|Dinner|Snack)?[:：\s]*\s*(.+?)\s*[·\-|（(]\s*(\d+)\s*k?cal/i);
          if (m) {
            const periodMap: Record<string, string> = {
              '早': '早', '早餐': '早', 'Breakfast': '早',
              '午': '午', '午餐': '午', 'Lunch': '午',
              '晚': '晚', '晚餐': '晚', 'Dinner': '晚',
              '零食': '零', 'Snack': '零',
            };
            return {
              tag: `Day ${m[1]} ${periodMap[m[2]] || ''}`,
              name: m[3].trim(),
              kcal: m[4],
            };
          }
          return null;
        }).filter(Boolean) as { tag: string; name: string; kcal: string }[];
      }
    } catch { /* fall through */ }
    return [
      { tag: 'Day 1 早', name: t('ai.diet.demo.breakfast1'), kcal: '420' },
      { tag: 'Day 1 午', name: t('ai.diet.demo.lunch1'), kcal: '560' },
      { tag: 'Day 1 晚', name: t('ai.diet.demo.dinner1'), kcal: '480' },
      { tag: 'Day 2 早', name: t('ai.diet.demo.breakfast2'), kcal: '380' },
    ];
  }, [aiResult, t]);

  if (loading && records.length === 0) {
    return <DietSkeleton />;
  }

  return (
    <div className="diet-page">
      {/* Page actions */}
      <div className="page-actions">
        <button className="chip-btn primary" onClick={() => setShowAddForm(true)}>
          + {t('diet.addFood')}
        </button>
      </div>

      {/* Date Picker Pill */}
      <div className="diet-date-row">
        <button className="diet-date-nav" onClick={() => changeDate(-1)} aria-label="Previous day">
          ‹
        </button>
        <div className="diet-date-pill">
          📅 {formatDateLabel(selectedDate, i18n.language)}
        </div>
        <button className="diet-date-nav" onClick={() => changeDate(1)} disabled={selectedDate >= todayStr} aria-label="Next day">
          ›
        </button>
        {selectedDate !== todayStr && (
          <button className="chip-btn ghost" onClick={() => setSelectedDate(todayStr)}>
            {t('diet.today')}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Macro Grid (2x2 with accent color bars) */}
      <div className="mini-macro-grid">
        <div className="mini-macro-item protein">
          <div className="mini-macro-value">
            {todayTotals.protein.toFixed(0)}<span className="mini-unit">g</span>
          </div>
          <div className="mini-macro-label">
            <span className="mini-macro-dot" />{t('diet.protein')}
          </div>
        </div>
        <div className="mini-macro-item carbs">
          <div className="mini-macro-value">
            {todayTotals.carbs.toFixed(0)}<span className="mini-unit">g</span>
          </div>
          <div className="mini-macro-label">
            <span className="mini-macro-dot" />{t('diet.carbs')}
          </div>
        </div>
        <div className="mini-macro-item fat">
          <div className="mini-macro-value">
            {todayTotals.fat.toFixed(0)}<span className="mini-unit">g</span>
          </div>
          <div className="mini-macro-label">
            <span className="mini-macro-dot" />{t('diet.fat')}
          </div>
        </div>
        <div className="mini-macro-item cal">
          <div className="mini-macro-value">
            {todayTotals.calories.toLocaleString()}
          </div>
          <div className="mini-macro-label">
            <span className="mini-macro-dot" />{t('diet.kcal')}
          </div>
        </div>
      </div>

      {/* Macro Distribution - Donut Card */}
      <div className="mini-chart-card">
        <div className="mini-chart-head">
          <div className="mini-chart-title">{t('diet.macroDistribution')}</div>
          <div className="mini-chart-sub">{t('diet.goalPct', { pct: caloriePct })}</div>
        </div>
        <div className="donut-wrap">
          <div
            className="donut-ring"
            style={{ background: donutSegments.grad || `conic-gradient(var(--chart-other) 0% 100%)` }}
          >
            <div className="donut-hole">{caloriePct}%</div>
          </div>
          <div className="donut-legend">
            <div><span style={{ color: 'var(--primary)' }}>■</span> {t('diet.protein')} {donutSegments.proteinPct}%</div>
            <div><span style={{ color: 'var(--secondary)' }}>■</span> {t('diet.carbs')} {donutSegments.carbsPct}%</div>
            <div><span style={{ color: 'var(--accent-orange)' }}>■</span> {t('diet.fat')} {donutSegments.fatPct}%</div>
          </div>
        </div>
      </div>

      {/* Meals */}
      {records.length === 0 ? (
        <div className="empty-state">
          <p>{t('diet.noMeals')}</p>
          <p className="text-muted">{t('diet.emptyState')}</p>
        </div>
      ) : (
        <div className="meals-container">
          {MEAL_TYPES.map(type => {
            const meals = groupedRecords[type] || [];
            if (meals.length === 0) return null;
            return (
              <div key={type} className="mini-meal-group">
                <div className="mini-meal-title">
                  <span>{MEAL_EMOJI[type]} {toTitleCase(t(`diet.${type}`))}</span>
                  <span className="kcal">{mealTotals[type]} kcal</span>
                </div>
                {meals.map(record => (
                  <div key={record.id} className="mini-meal-item">
                    <span className="food-name">
                      {record.food_name}
                      {record.portion_description && (
                        <em> · {record.portion_description}</em>
                      )}
                    </span>
                    <span className="kcal">{Number(record.calories || 0)} kcal</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Diet Section */}
      <div className="mini-ai-section" data-ai-block="diet">
        <h3>{t('ai.diet.title')}</h3>
        <p className="desc">{t('ai.diet.desc')}</p>

        {aiState === 'idle' && (
          <button className="mini-ai-btn" onClick={handleAIAnalysis}>
            🥗 {t('ai.diet.generate')}
          </button>
        )}

        {aiState === 'loading' && (
          <div className="mini-ai-loading">
            <div className="mini-ai-spinner" />
            <p>{t('ai.diet.loading')}</p>
            <span className="hint">{t('ai.diet.loadingHint')}</span>
          </div>
        )}

        {aiState === 'error' && (
          <div className="mini-ai-error">
            <div className="alert alert-error">{aiError || t('ai.analysisFailed')}</div>
            <div className="res-actions">
              <button className="primary" onClick={handleAIAnalysis}>{t('ai.diet.regenerate')}</button>
              <button onClick={() => { setAiError(''); setAiState('idle'); }}>{t('training.cancel')}</button>
            </div>
          </div>
        )}

        {aiState === 'result' && aiResult && (
          <div className="mini-ai-result">
            <h4>📋 {t('ai.diet.resultTitle')}</h4>
            {aiPlanRows.map((row, idx) => (
              <div key={idx} className="mini-ai-plan-row">
                <span className="tag">{row.tag}</span>
                <span className="name">{row.name}</span>
                <span className="kcal">{row.kcal}</span>
              </div>
            ))}
            <div className="res-actions">
              <button className="primary">{t('ai.diet.viewFull')}</button>
              <button onClick={handleAIAnalysis}>{t('ai.diet.regenerate')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Food Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => { setShowAddForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('diet.addFoodTitle')}</h2>
              <button className="btn-close" onClick={() => { setShowAddForm(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="form-group">
                <label>{t('diet.mealType')} *</label>
                <select value={mealType} onChange={e => setMealType(e.target.value)}>
                  {MEAL_TYPES.map(mt => <option key={mt} value={mt}>{t(`diet.${mt}`)}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>{t('diet.foodName')} *</label>
                <input
                  type="text"
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder={t('diet.foodNamePlaceholder')}
                />
              </div>

              <div className="form-group">
                <label>{t('diet.portion')}</label>
                <input
                  type="text"
                  value={portion}
                  onChange={e => setPortion(e.target.value)}
                  placeholder={t('diet.portionPlaceholder')}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('diet.calories')}</label>
                  <input type="number" value={calories ?? ''} onChange={e => setCalories(e.target.value ? Number(e.target.value) : undefined)} placeholder="350" min={0} />
                </div>
                <div className="form-group">
                  <label>{t('diet.protein')} (g)</label>
                  <input type="number" value={protein ?? ''} onChange={e => setProtein(e.target.value ? Number(e.target.value) : undefined)} placeholder="30" step="0.1" min={0} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('diet.carbs')} (g)</label>
                  <input type="number" value={carbs ?? ''} onChange={e => setCarbs(e.target.value ? Number(e.target.value) : undefined)} placeholder="40" step="0.1" min={0} />
                </div>
                <div className="form-group">
                  <label>{t('diet.fat')} (g)</label>
                  <input type="number" value={fat ?? ''} onChange={e => setFat(e.target.value ? Number(e.target.value) : undefined)} placeholder="10" step="0.1" min={0} />
                </div>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleAddRecord} disabled={saving}>
                {saving ? t('diet.adding') : t('diet.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
