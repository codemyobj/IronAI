import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import type { DietRecord } from '../types';

interface DietSummary {
  total_entries: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface DailyBreakdown {
  recorded_at: string;
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fat: number;
  entries: number;
}

export function useDiet() {
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<DietSummary | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecords = useCallback(async (date?: string) => {
    const targetDate = date || selectedDate;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/diet/records', { params: { date: targetDate } });
      setRecords(res.data.records);
      setSelectedDate(targetDate);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load diet records');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchSummary = useCallback(async (start: string, end: string) => {
    try {
      const res = await apiClient.get('/diet/summary', { params: { start, end } });
      setSummary(res.data.summary);
      setDailyBreakdown(res.data.daily);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load summary');
    }
  }, []);

  const addRecord = async (data: {
    meal_type: string;
    food_name: string;
    calories?: number;
    protein_grams?: number;
    carbs_grams?: number;
    fat_grams?: number;
    portion_description?: string;
    recorded_at?: string;
  }) => {
    const res = await apiClient.post('/diet/records', data);
    setRecords(prev => [...prev, res.data.record]);
    return res.data.record;
  };

  const deleteRecord = async (id: number) => {
    await apiClient.delete(`/diet/records/${id}`);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // Fetch records on mount and when date changes
  useEffect(() => {
    fetchRecords(selectedDate);
  }, [selectedDate]);

  // Fetch weekly summary on mount
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const start = weekAgo.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    fetchSummary(start, end);
  }, [fetchSummary]);

  return {
    records,
    selectedDate,
    setSelectedDate,
    summary,
    dailyBreakdown,
    loading,
    error,
    fetchRecords,
    fetchSummary,
    addRecord,
    deleteRecord,
  };
}
