import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useHeader } from '../context/HeaderContext';
import { ChartCard } from '../components/Charts';
import apiClient from '../api';
import type { BodyMeasurement } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

/** 无历史记录时的占位趋势：基于当前体重向目标缓慢靠拢的平滑曲线 */
function buildWeightTrend(current: number, target: number, days = 30) {
  const data: { date: string; weight: number }[] = [];
  const now = new Date();
  const start = current + Math.max(0.5, (current - target) / 3);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const t = 1 - i / (days - 1);
    const eased = 1 - Math.pow(1 - t, 2);
    let w = start + (current - start) * eased;
    w += Math.sin(i * 0.7) * 0.15;
    data.push({
      date: d.toISOString().slice(0, 10),
      weight: Math.round(w * 10) / 10,
    });
  }
  return data;
}

/** Deurenberg 体脂率估算（默认男性） */
function estimateBodyFat(weightKg: number, heightCm: number, age: number): number {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const bf = 1.2 * bmi + 0.23 * age - 16.2;
  return Math.max(5, Math.min(45, Math.round(bf * 10) / 10));
}

function estimateMuscle(weightKg: number, bodyFatPct: number): number {
  const lean = weightKg * (1 - bodyFatPct / 100);
  return Math.round(lean * 10) / 10;
}

export default function BodyPage() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { setHeader } = useHeader();

  const weight = Number(user?.weight_kg) || 0;
  const height = Number(user?.height_cm) || 0;
  const age = Number(user?.age) || 25;

  const targetBmi = user?.fitness_goal === 'muscle_gain' ? 24
    : user?.fitness_goal === 'weight_loss' ? 22 : 23;
  const targetWeight = height > 0
    ? Math.round(targetBmi * Math.pow(height / 100, 2) * 10) / 10
    : weight - 3;

  const diffToGoal = Math.max(0, Math.round((weight - targetWeight) * 10) / 10);

  const bodyFat = weight > 0 && height > 0 ? estimateBodyFat(weight, height, age) : 0;
  const muscle = weight > 0 && bodyFat > 0 ? estimateMuscle(weight, bodyFat) : 0;
  const bmi = weight > 0 && height > 0
    ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10
    : 0;
  const waist = height > 0 && bmi > 0
    ? Math.round((height * 0.42 + (bmi - 22) * 1.8) * 10) / 10
    : 0;

  // --- 真实体测记录 ---
  const [records, setRecords] = useState<BodyMeasurement[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string>('');

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const res = await apiClient.get('/body/records', { params: { days: 30 } });
      setRecords(res.data.records || []);
    } catch (err: any) {
      setRecordsError(err.response?.data?.error || t('body.loadFailed'));
    } finally {
      setRecordsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 趋势数据：有真实记录用真实数据，否则用占位曲线
  const trendData = useMemo(() => {
    if (records.length > 0) {
      return records.map(r => ({ date: r.measured_at, weight: r.weight_kg }));
    }
    return weight > 0 ? buildWeightTrend(weight, targetWeight) : [];
  }, [records, weight, targetWeight]);

  const thirtyDayDelta = trendData.length >= 2
    ? Math.round((trendData[trendData.length - 1].weight - trendData[0].weight) * 10) / 10
    : 0;

  // --- 记录弹窗 ---
  const [showLog, setShowLog] = useState(false);
  const [logWeight, setLogWeight] = useState<string>('');
  const [logBodyFat, setLogBodyFat] = useState<string>('');
  const [logMuscle, setLogMuscle] = useState<string>('');
  const [logWaist, setLogWaist] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');

  const openLog = () => {
    setLogWeight(weight ? String(weight) : '');
    setLogBodyFat(bodyFat ? String(bodyFat) : '');
    setLogMuscle(muscle ? String(muscle) : '');
    setLogWaist(waist ? String(waist) : '');
    setSaveError('');
    setShowLog(true);
  };

  /** 客户端输入校验，返回错误信息或空字符串 */
  const validateForm = (): string => {
    const w = parseFloat(logWeight);
    if (!w || w <= 0) return t('body.weightRequired');
    if (w < 20 || w > 500) return t('body.weightRange');

    if (logBodyFat) {
      const bf = parseFloat(logBodyFat);
      if (isNaN(bf) || bf < 1 || bf > 80) return t('body.bodyFatRange');
    }
    if (logMuscle) {
      const m = parseFloat(logMuscle);
      if (isNaN(m) || m < 10 || m > 500) return t('body.muscleRange');
    }
    if (logWaist) {
      const wc = parseFloat(logWaist);
      if (isNaN(wc) || wc < 30 || wc > 300) return t('body.waistRange');
    }
    return '';
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      setSaveError(err);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload: Record<string, number> = { weight_kg: parseFloat(logWeight) };
      if (logBodyFat) payload.body_fat_pct = parseFloat(logBodyFat);
      if (logMuscle) payload.muscle_kg = parseFloat(logMuscle);
      if (logWaist) payload.waist_cm = parseFloat(logWaist);

      await apiClient.post('/body/records', payload);
      // 同步更新 user.weight_kg（个人资料 / Header 数据）
      await updateProfile({ weight_kg: payload.weight_kg });
      setShowLog(false);
      fetchRecords();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || t('body.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Header
  useEffect(() => {
    setHeader({
      title: t('body.title'),
      subtitle: t('body.subtitle', { diff: diffToGoal }),
      actions: (
        <button
          type="button"
          className="chip-btn primary body-log-btn"
          onClick={openLog}
          aria-label={t('body.log')}
        >
          {t('body.log')}
        </button>
      ),
    });
  }, [t, setHeader, diffToGoal]);

  if (!weight) {
    return (
      <div className="body-page">
        <div className="empty-state">
          <p>{t('body.logWeightTitle')}</p>
          <button className="btn btn-primary" onClick={openLog}>{t('body.log')}</button>
        </div>
      </div>
    );
  }

  // 最近 3 条记录（最新在前）
  const recentRecords = [...records].reverse().slice(0, 3);

  return (
    <div className="body-page">
      {/* 当前体重卡片（渐变） */}
      <section className="body-weight-card" aria-label={t('body.currentWeight')}>
        <div className="body-weight-label">{t('body.currentWeight')}</div>
        <div className="body-weight-value">
          {weight.toFixed(1)}<span className="body-weight-unit">kg</span>
        </div>
        <div className="body-weight-chips">
          <span className="body-chip body-chip-down">
            {thirtyDayDelta <= 0 ? '↓' : '↑'} {Math.abs(thirtyDayDelta).toFixed(1)} kg · 30 {t('body.thirtyDays').replace(/^\d+\s*/, '')}
          </span>
          <span className="body-chip">🎯 {t('body.target', { weight: targetWeight })}</span>
        </div>
      </section>

      {/* 体重趋势图 */}
      <ChartCard title={t('body.weightTrend')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="chart-sub">{t('body.thirtyDays')}</span>
          <span className="body-target-chip">🎯 {targetWeight} kg</span>
        </div>
        {recordsLoading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {t('body.loading')}
          </div>
        ) : recordsError ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {recordsError}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(d) => {
                  const date = new Date(d + 'T00:00:00');
                  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                }}
                interval={Math.floor(trendData.length / 3) - 1}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                domain={['dataMin - 1', 'dataMax + 1']}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => [`${v} kg`, t('body.currentWeight')]}
                labelFormatter={(l) => {
                  const d = new Date(l + 'T00:00:00');
                  return d.toLocaleDateString();
                }}
              />
              <ReferenceLine
                y={targetWeight}
                stroke="#f97316"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 体脂 / 肌肉 / 腰围 / BMI 四宫格 */}
      <div className="body-metrics-grid" role="list" aria-label={t('body.metrics')}>
        <div className="body-metric-card" role="listitem">
          <div className="body-metric-value">
            {bodyFat.toFixed(1)}<span className="body-metric-unit">%</span>
          </div>
          <div className="body-metric-label">{t('body.bodyFat')}</div>
        </div>
        <div className="body-metric-card" role="listitem">
          <div className="body-metric-value">
            {muscle.toFixed(1)}<span className="body-metric-unit">kg</span>
          </div>
          <div className="body-metric-label">{t('body.muscle')}</div>
        </div>
        <div className="body-metric-card" role="listitem">
          <div className="body-metric-value">
            {waist.toFixed(0)}<span className="body-metric-unit">cm</span>
          </div>
          <div className="body-metric-label">{t('body.waist')}</div>
        </div>
        <div className="body-metric-card" role="listitem">
          <div className="body-metric-value">{bmi.toFixed(1)}</div>
          <div className="body-metric-label">{t('body.bmi')}</div>
        </div>
      </div>

      {/* 最近记录 */}
      <section className="body-records" aria-label={t('body.recentRecords')}>
        <h3 className="body-records-title">{t('body.recentRecords')}</h3>
        <div className="body-records-list">
          {recentRecords.length > 0 ? recentRecords.map((r, i, arr) => {
            const next = arr[i + 1];
            const delta = next ? Math.round((r.weight_kg - next.weight_kg) * 10) / 10 : 0;
            const date = new Date(r.measured_at + 'T00:00:00');
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const bf = r.body_fat_pct ?? estimateBodyFat(r.weight_kg, height, age);
            return (
              <div key={r.id} className="body-record-row">
                <div className="body-record-main">
                  <span className="body-record-weight">{r.weight_kg.toFixed(1)} kg</span>
                  <span className="body-record-meta">{dateStr} · {bf.toFixed(1)}% fat</span>
                </div>
                <span
                  className={`body-record-delta ${delta < 0 ? 'down' : delta > 0 ? 'up' : ''}`}
                  aria-label={delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : undefined}
                >
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </span>
              </div>
            );
          }) : (
            <p className="text-muted" style={{ textAlign: 'center', padding: '20px 0' }}>{t('body.noRecords')}</p>
          )}
        </div>
      </section>

      {/* 记录体重弹窗 */}
      {showLog && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setShowLog(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="body-log-title"
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="body-log-title" className="modal-title">{t('body.logWeightTitle')}</h3>
            {saveError && <div className="alert alert-error" role="alert">{saveError}</div>}
            <div className="form-group">
              <label htmlFor="body-log-weight">{t('body.weightLabel')}</label>
              <input
                id="body-log-weight"
                type="number"
                step="0.1"
                min="20"
                max="500"
                value={logWeight}
                onChange={(e) => setLogWeight(e.target.value)}
                placeholder="70.0"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="body-log-fat">{t('body.bodyFatLabel')}</label>
              <input
                id="body-log-fat"
                type="number"
                step="0.1"
                min="1"
                max="80"
                value={logBodyFat}
                onChange={(e) => setLogBodyFat(e.target.value)}
                placeholder="18.5"
              />
            </div>
            <div className="form-group">
              <label htmlFor="body-log-muscle">{t('body.muscleLabel')}</label>
              <input
                id="body-log-muscle"
                type="number"
                step="0.1"
                min="10"
                max="500"
                value={logMuscle}
                onChange={(e) => setLogMuscle(e.target.value)}
                placeholder="62.0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="body-log-waist">{t('body.waistLabel')}</label>
              <input
                id="body-log-waist"
                type="number"
                step="0.1"
                min="30"
                max="300"
                value={logWaist}
                onChange={(e) => setLogWaist(e.target.value)}
                placeholder="82"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowLog(false)} disabled={saving}>
                {t('body.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('body.saving') : t('body.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
