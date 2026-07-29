import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTraining } from '../hooks/useTraining'

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

const mockPrograms = [
  {
    id: 1,
    user_id: 1,
    name: 'Push Day',
    description: 'Chest and triceps',
    difficulty: 'intermediate',
    target_muscle_group: 'Chest',
    exercises: [],
  },
  {
    id: 2,
    user_id: 1,
    name: 'Pull Day',
    description: 'Back and biceps',
    difficulty: 'beginner',
    target_muscle_group: 'Back',
    exercises: [],
  },
]

describe('useTraining', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url === '/training/programs') {
        return Promise.resolve({ data: { programs: mockPrograms } })
      }
      if (url.startsWith('/training/programs/')) {
        const id = parseInt(url.split('/').pop()!)
        const program = mockPrograms.find(p => p.id === id) || mockPrograms[0]
        return Promise.resolve({ data: { program: { ...program, exercises: [] } } })
      }
      if (url === '/training/sessions') {
        return Promise.resolve({ data: { sessions: [] } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    mockPost.mockImplementation((url: string, data: any) => {
      if (url === '/training/programs') {
        return Promise.resolve({ data: { program: { id: 3, ...data, exercises: [] } } })
      }
      if (url.includes('/exercises')) {
        return Promise.resolve({ data: { exercise: { id: 1, ...data } } })
      }
      if (url === '/training/sessions') {
        return Promise.resolve({ data: { session: { id: 1, ...data } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    mockDelete.mockImplementation(() => Promise.resolve({ data: {} }))
  })

  it('should fetch programs on mount', async () => {
    const { result } = renderHook(() => useTraining())

    await waitFor(() => {
      expect(result.current.programs).toHaveLength(2)
      expect(result.current.loading).toBe(false)
    })
  })

  it('should fetch a single program', async () => {
    const { result } = renderHook(() => useTraining())

    await waitFor(() => expect(result.current.programs).toHaveLength(2))

    let program: any
    await act(async () => {
      program = await result.current.fetchProgram(1)
    })

    expect(program).not.toBeNull()
    expect(program.name).toBe('Push Day')
  })

  it('should create a program', async () => {
    const { result } = renderHook(() => useTraining())

    await waitFor(() => expect(result.current.programs).toHaveLength(2))

    let created: any
    await act(async () => {
      created = await result.current.createProgram({
        name: 'Leg Day',
        difficulty: 'advanced',
      })
    })

    expect(created.name).toBe('Leg Day')
    expect(result.current.programs).toHaveLength(3)
  })

  it('should delete a program', async () => {
    const { result } = renderHook(() => useTraining())

    await waitFor(() => expect(result.current.programs).toHaveLength(2))

    await act(async () => {
      await result.current.deleteProgram(1)
    })

    expect(mockDelete).toHaveBeenCalledWith('/training/programs/1')
    expect(result.current.programs).toHaveLength(1)
  })

  it('should log a session', async () => {
    const { result } = renderHook(() => useTraining())

    let session: any
    await act(async () => {
      session = await result.current.logSession({
        program_id: 1,
        duration_minutes: 45,
        perceived_effort: 7,
      })
    })

    expect(session.duration_minutes).toBe(45)
    expect(mockPost).toHaveBeenCalledWith('/training/sessions', expect.objectContaining({
      duration_minutes: 45,
    }))
  })

  it('should handle fetch error', async () => {
    mockGet.mockRejectedValueOnce({ response: { data: { error: 'Failed to load' } } })

    const { result } = renderHook(() => useTraining())

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load')
      expect(result.current.loading).toBe(false)
    })
  })
})