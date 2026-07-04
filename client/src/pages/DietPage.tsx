import { useState } from 'react';
import { useDiet } from '../hooks/useDiet';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function DietPage() {
  const {
    records,
    selectedDate,
    setSelectedDate,
    summary,
    dailyBreakdown,
    loading,
    error,
    addRecord,
    deleteRecord,
  } = useDiet();

  // Add food form
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

  // Date navigation
  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handleAddRecord = async () => {
    setFormError('');
    if (!foodName.trim()) {
      setFormError('Food name is required');
      return;
    }
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
      setFormError(err.response?.data?.error || 'Failed to add food');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm('Delete this food entry?')) return;
    try {
      await deleteRecord(id);
    } catch {
      // error handled by hook
    }
  };

  function resetForm() {
    setFoodName('');
    setCalories(undefined);
    setProtein(undefined);
    setCarbs(undefined);
    setFat(undefined);
    setPortion('');
    setMealType('breakfast');
    setFormError('');
  }

  // Calculate today's totals from records
  const todayTotals = records.reduce(
    (acc, r) => ({
      calories: acc.calories + (r.calories || 0),
      protein: acc.protein + (r.protein_grams || 0),
      carbs: acc.carbs + (r.carbs_grams || 0),
      fat: acc.fat + (r.fat_grams || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const groupedRecords: Record<string, typeof records> = {};
  for (const r of records) {
    if (!groupedRecords[r.meal_type]) groupedRecords[r.meal_type] = [];
    groupedRecords[r.meal_type].push(r);
  }

  if (loading && records.length === 0) {
    return <div className="page-loading">Loading diet records...</div>;
  }

  return (
    <div className="diet-page">
      <div className="page-header">
        <h1>Diet Tracker</h1>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + Add Food
        </button>
      </div>

      {/* Date Picker */}
      <div className="date-picker">
        <button className="btn btn-outline btn-sm" onClick={() => changeDate(-1)}>◀</button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          max={todayStr}
        />
        <button className="btn btn-outline btn-sm" onClick={() => changeDate(1)} disabled={selectedDate >= todayStr}>
          ▶
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => setSelectedDate(todayStr)}>
          Today
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Calorie Summary Bar */}
      <div className="macro-bar">
        <div className="macro-item">
          <span className="macro-value">{todayTotals.calories}</span>
          <span className="macro-label">Calories</span>
        </div>
        <div className="macro-item">
          <span className="macro-value">{todayTotals.protein.toFixed(1)}g</span>
          <span className="macro-label">Protein</span>
        </div>
        <div className="macro-item">
          <span className="macro-value">{todayTotals.carbs.toFixed(1)}g</span>
          <span className="macro-label">Carbs</span>
        </div>
        <div className="macro-item">
          <span className="macro-value">{todayTotals.fat.toFixed(1)}g</span>
          <span className="macro-label">Fat</span>
        </div>
      </div>

      {/* Meal Type Groups */}
      {records.length === 0 ? (
        <div className="empty-state">
          <p>No meals logged for this day.</p>
          <p className="text-muted">Tap "+ Add Food" to start tracking your diet!</p>
        </div>
      ) : (
        <div className="meals-container">
          {MEAL_TYPES.map(type => {
            const meals = groupedRecords[type] || [];
            if (meals.length === 0) return null;
            return (
              <div key={type} className="meal-group">
                <h3 className="meal-type-title">{type}</h3>
                <div className="meal-items">
                  {meals.map(record => (
                    <div key={record.id} className="meal-item">
                      <div className="meal-item-info">
                        <strong>{record.food_name}</strong>
                        {record.portion_description && (
                          <span className="text-muted">{record.portion_description}</span>
                        )}
                        <div className="meal-macros">
                          {record.calories && <span>{record.calories} kcal</span>}
                          {record.protein_grams && <span>P: {record.protein_grams}g</span>}
                          {record.carbs_grams && <span>C: {record.carbs_grams}g</span>}
                          {record.fat_grams && <span>F: {record.fat_grams}g</span>}
                        </div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteRecord(record.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Summary */}
      {dailyBreakdown.length > 0 && (
        <div className="weekly-summary">
          <h2>This Week's Overview</h2>
          <div className="weekly-grid">
            {dailyBreakdown.map(day => (
              <div key={day.recorded_at} className="weekly-day">
                <div className="weekly-date">
                  {new Date(day.recorded_at + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div className="weekly-calories">{day.daily_calories}</div>
                <div className="weekly-macros">
                  P:{day.daily_protein}g C:{day.daily_carbs}g F:{day.daily_fat}g
                </div>
              </div>
            ))}
          </div>
          {summary && (
            <div className="weekly-totals">
              <span>Weekly avg: {(summary.total_calories / dailyBreakdown.filter(d => d.entries > 0).length || 1).toFixed(0)} kcal/day</span>
              <span>Total protein: {summary.total_protein.toFixed(0)}g</span>
            </div>
          )}
        </div>
      )}

      {/* Add Food Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => { setShowAddForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Food Entry</h2>
              <button className="btn-close" onClick={() => { setShowAddForm(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              <div className="form-group">
                <label>Meal Type *</label>
                <select value={mealType} onChange={e => setMealType(e.target.value)}>
                  {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Food Name *</label>
                <input
                  type="text"
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder="e.g. Grilled Chicken Breast"
                />
              </div>

              <div className="form-group">
                <label>Portion Description</label>
                <input
                  type="text"
                  value={portion}
                  onChange={e => setPortion(e.target.value)}
                  placeholder="e.g. 200g, 1 cup, 2 slices"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Calories</label>
                  <input type="number" value={calories ?? ''} onChange={e => setCalories(e.target.value ? Number(e.target.value) : undefined)} placeholder="350" min={0} />
                </div>
                <div className="form-group">
                  <label>Protein (g)</label>
                  <input type="number" value={protein ?? ''} onChange={e => setProtein(e.target.value ? Number(e.target.value) : undefined)} placeholder="30" step="0.1" min={0} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Carbs (g)</label>
                  <input type="number" value={carbs ?? ''} onChange={e => setCarbs(e.target.value ? Number(e.target.value) : undefined)} placeholder="40" step="0.1" min={0} />
                </div>
                <div className="form-group">
                  <label>Fat (g)</label>
                  <input type="number" value={fat ?? ''} onChange={e => setFat(e.target.value ? Number(e.target.value) : undefined)} placeholder="10" step="0.1" min={0} />
                </div>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleAddRecord} disabled={saving}>
                {saving ? 'Adding...' : 'Add Food'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
