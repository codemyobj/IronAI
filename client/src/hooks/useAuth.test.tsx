import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('../api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}))

const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  age: 25,
  height_cm: 175,
  weight_kg: 70,
  fitness_goal: 'general' as const,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGet.mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({ data: { user: mockUser } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    mockPost.mockImplementation((url: string) => {
      if (url === '/auth/login') {
        return Promise.resolve({ data: { token: 'jwt-token-123', user: mockUser } })
      }
      if (url === '/auth/register') {
        return Promise.resolve({ data: { token: 'jwt-token-456', user: mockUser } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  it('should auto-login if token exists', async () => {
    localStorage.setItem('token', 'existing-token')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.loading).toBe(false)
    })

    expect(mockGet).toHaveBeenCalledWith('/auth/me')
  })

  it('should skip loading if no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })

  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })

    expect(localStorage.getItem('token')).toBe('jwt-token-123')
    expect(result.current.user).toEqual(mockUser)
  })

  it('should register successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })
    })

    expect(localStorage.getItem('token')).toBe('jwt-token-456')
    expect(result.current.user).toEqual(mockUser)
  })

  it('should logout and clear token', async () => {
    localStorage.setItem('token', 'existing-token')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.user).toEqual(mockUser))

    await act(async () => {
      result.current.logout()
    })

    expect(localStorage.getItem('token')).toBeNull()
    expect(result.current.user).toBeNull()
  })
})