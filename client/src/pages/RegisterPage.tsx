import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import type { RegisterData } from '../types';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();

  const fitnessGoals = [
    { value: 'general', label: t('goals.general') },
    { value: 'lose_weight', label: t('goals.weight_loss') },
    { value: 'build_muscle', label: t('goals.build_muscle') },
    { value: 'endurance', label: t('goals.endurance') },
  ];

  const [form, setForm] = useState<RegisterData>({
    email: '',
    password: '',
    name: '',
    age: undefined,
    height_cm: undefined,
    weight_kg: undefined,
    fitness_goal: 'general',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof RegisterData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim() || !form.password.trim() || !form.name.trim()) {
      setError(t('common.requiredFields'));
      return;
    }
    if (form.password.length < 6) {
      setError(t('common.passwordTooShort'));
      return;
    }
    if (!form.email.includes('@')) {
      setError(t('common.invalidEmail'));
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="navbar-logo">I</span>
          <span className="auth-brand-name">IronAI</span>
        </div>
        <h1 className="auth-title">{t('auth.register.title')}</h1>
        <p className="auth-subtitle">{t('auth.register.subtitle')}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">{t('auth.register.name')} *</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder={t('auth.register.namePlaceholder')}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.register.email')} *</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder={t('auth.register.emailPlaceholder')}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.register.password')}</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={e => updateField('password', e.target.value)}
              placeholder={t('auth.register.passwordPlaceholder')}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="goal">{t('auth.register.fitnessGoal')}</label>
            <select
              id="goal"
              value={form.fitness_goal}
              onChange={e => updateField('fitness_goal', e.target.value)}
              disabled={loading}
            >
              {fitnessGoals.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="age">{t('auth.register.age')}</label>
              <input
                id="age"
                type="number"
                min={10}
                max={120}
                value={form.age ?? ''}
                onChange={e => updateField('age', e.target.value ? Number(e.target.value) : undefined)}
                placeholder={t('auth.register.agePlaceholder')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="height">{t('auth.register.height')}</label>
              <input
                id="height"
                type="number"
                step="0.1"
                min={50}
                max={250}
                value={form.height_cm ?? ''}
                onChange={e => updateField('height_cm', e.target.value ? Number(e.target.value) : undefined)}
                placeholder={t('auth.register.heightPlaceholder')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="weight">{t('auth.register.weight')}</label>
              <input
                id="weight"
                type="number"
                step="0.1"
                min={20}
                max={300}
                value={form.weight_kg ?? ''}
                onChange={e => updateField('weight_kg', e.target.value ? Number(e.target.value) : undefined)}
                placeholder={t('auth.register.weightPlaceholder')}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t('auth.register.submitting') : t('auth.register.submit')}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth.register.hasAccount')} <Link to="/login">{t('auth.register.login')}</Link>
        </p>
      </div>
    </div>
  );
}
