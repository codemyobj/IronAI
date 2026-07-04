import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import type { TrainingProgram, Exercise } from '../types';

export function useTraining() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/training/programs');
      setPrograms(res.data.programs);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProgram = async (id: number): Promise<TrainingProgram | null> => {
    try {
      const res = await apiClient.get(`/training/programs/${id}`);
      return res.data.program;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load program');
      return null;
    }
  };

  const createProgram = async (data: {
    name: string;
    description?: string;
    difficulty?: string;
    target_muscle_group?: string;
    exercises?: Omit<Exercise, 'id' | 'program_id'>[];
  }) => {
    const res = await apiClient.post('/training/programs', data);
    setPrograms(prev => [res.data.program, ...prev]);
    return res.data.program;
  };

  const deleteProgram = async (id: number) => {
    await apiClient.delete(`/training/programs/${id}`);
    setPrograms(prev => prev.filter(p => p.id !== id));
  };

  const addExercise = async (programId: number, data: {
    name: string;
    sets?: number;
    reps?: number;
    weight_kg?: number;
    rest_seconds?: number;
  }) => {
    const res = await apiClient.post(`/training/programs/${programId}/exercises`, data);
    return res.data.exercise;
  };

  const deleteExercise = async (exerciseId: number) => {
    await apiClient.delete(`/training/exercises/${exerciseId}`);
  };

  const logSession = async (data: {
    program_id?: number;
    duration_minutes?: number;
    perceived_effort?: number;
    notes?: string;
  }) => {
    const res = await apiClient.post('/training/sessions', data);
    return res.data.session;
  };

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  return {
    programs,
    loading,
    error,
    fetchPrograms,
    fetchProgram,
    createProgram,
    deleteProgram,
    addExercise,
    deleteExercise,
    logSession,
  };
}
