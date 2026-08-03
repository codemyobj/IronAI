import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDiet } from './useDiet'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}))

const mockRecords = [
  {
    id: 1,
    meal_type: 'breakfast' as const,
    food_name: 'Oatmeal',
    calories: 300,
    protein_grams: 10,
    carbs_grams: 50,
    fat_grams: 5,
    portion_description: '1 bowl',
    recorded_at: '2026-07-27',
  },
  {
    id: 2,
    meal_type: 'lunch' as const,
    food_name: 'Chicken Salad',
    calories: 450,
    protein_grams: 35,
    carbs_grams: 20,
    fat_grams: 15,
    portion_description: null,
    recorded_at: '2026-07-27',
  },
]

const mockSummary = {
  total_entries: 5,
  total_calories: 1500,
  total_protein: 80,
  total_carbs: 150,
  total_fat: 40,
}

const mockDaily = [
  { recorded_at: '2026-07-27', daily_calories: 750, daily_protein: 45, daily_carbs: 70, daily_fat: 20, entries: 2 },
  { recorded_at: '2026-07-26', daily_calories: 750, daily_protein: 35, daily_carbs: 80, daily_fat: 20, entries: 3 },
]

describe('useDiet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url === '/diet/records') {
        return Promise.resolve({ data: { records: mockRecords } })
      }
      if (url === '/diet/summary') {
        return Promise.resolve({ data: { summary: mockSummary, daily: mockDaily } })
      }
      return Promise.reject(new Error('Unknown URL: ' + url))
    })
    mockPost.mockImplementation((_url: string, data: any) => {
      const newRecord = { id: 3, ...data, recorded_at: data.recorded_at || '2026-07-27' }
      return Promise.resolve({ data: { record: newRecord } })
    })
    mockDelete.mockImplementation(() => Promise.resolve({ data: {} }))
  })

  it('should fetch records and summary on mount', async () => {
    const { result } = renderHook(() => useDiet())

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
      expect(result.current.loading).toBe(false)
    })

    expect(mockGet).toHaveBeenCalledWith('/diet/records', { params: { date: expect.any(String) } })
    expect(mockGet).toHaveBeenCalledWith('/diet/summary', { params: { start: expect.any(String), end: expect.any(String) } })
  })

  it('should fetch weekly summary on mount', async () => {
    const { result } = renderHook(() => useDiet())

    await waitFor(() => {
      expect(result.current.summary).toEqual(mockSummary)
      expect(result.current.dailyBreakdown).toHaveLength(2)
    })
  })

  it('should add a record and update records list', async () => {
    const { result } = renderHook(() => useDiet())

    await waitFor(() => expect(result.current.records).toHaveLength(2))

    await act(async () => {
      await result.current.addRecord({
        meal_type: 'dinner',
        food_name: 'Salmon',
        calories: 500,
        protein_grams: 40,
        carbs_grams: 10,
        fat_grams: 20,
        recorded_at: '2026-07-27',
      })
    })

    expect(mockPost).toHaveBeenCalledWith('/diet/records', expect.objectContaining({
      meal_type: 'dinner',
      food_name: 'Salmon',
    }))

    await waitFor(() => {
      expect(result.current.records).toHaveLength(3)
    })
  })

  it('should delete a record and remove it from list', async () => {
    const { result } = renderHook(() => useDiet())

    await waitFor(() => expect(result.current.records).toHaveLength(2))

    await act(async () => {
      await result.current.deleteRecord(1)
    })

    expect(mockDelete).toHaveBeenCalledWith('/diet/records/1')
    expect(result.current.records).toHaveLength(1)
  })

  it('should handle fetch error', async () => {
    mockGet.mockRejectedValueOnce({ response: { data: { error: 'Server error' } } })

    const { result } = renderHook(() => useDiet())

    await waitFor(() => {
      expect(result.current.error).toBe('Server error')
      expect(result.current.loading).toBe(false)
    })
  })

  it('should handle addRecord error', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { error: 'Failed to add' } } })

    const { result } = renderHook(() => useDiet())

    await waitFor(() => expect(result.current.records).toHaveLength(2))

    await act(async () => {
      try {
        await result.current.addRecord({ meal_type: 'snack', food_name: 'Apple' })
      } catch {
        // expected
      }
    })

    expect(result.current.records).toHaveLength(2)
  })

  it('should allow changing date and refetch records', async () => {
    const { result } = renderHook(() => useDiet())

    await waitFor(() => expect(result.current.records).toHaveLength(2))

    await act(async () => {
      result.current.setSelectedDate('2026-07-26')
    })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/diet/records', { params: { date: '2026-07-26' } })
    })
  })

  it('should handle summary fetch failure gracefully', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/diet/records') {
        return Promise.resolve({ data: { records: mockRecords } })
      }
      if (url === '/diet/summary') {
        return Promise.reject({ response: { data: { error: 'Summary failed' } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const { result } = renderHook(() => useDiet())

    await waitFor(() => {
      expect(result.current.records).toHaveLength(2)
      expect(result.current.error).toBe('Summary failed')
    })
  })
})