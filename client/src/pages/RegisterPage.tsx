import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { RegisterData } from '../types';

const FITNESS_GOALS = [
  { value: 'general', label: 'General Fitness' },
  { value: 'lose_weight', label: 'Lose Weight' },
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'endurance', label: 'Endurance' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

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
      setError('Email, password, and name are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Start your fitness journey with IronAI</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password * (min 6 characters)</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={e => updateField('password', e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="goal">Fitness Goal</label>
            <select
              id="goal"
              value={form.fitness_goal}
              onChange={e => updateField('fitness_goal', e.target.value)}
              disabled={loading}
            >
              {FITNESS_GOALS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                min={10}
                max={120}
                value={form.age ?? ''}
                onChange={e => updateField('age', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="25"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="height">Height (cm)</label>
              <input
                id="height"
                type="number"
                step="0.1"
                min={50}
                max={250}
                value={form.height_cm ?? ''}
                onChange={e => updateField('height_cm', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="175"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>
              <input
                id="weight"
                type="number"
                step="0.1"
                min={20}
                max={300}
                value={form.weight_kg ?? ''}
                onChange={e => updateField('weight_kg', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="70"
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
