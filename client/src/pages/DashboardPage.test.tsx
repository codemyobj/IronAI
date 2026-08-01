import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

const mockGet = vi.fn()

vi.mock('../api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  age: 25,
  height_cm: 175,
  weight_kg: 70,
  fitness_goal: 'build_muscle' as const,
}

const mockUseAuth = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockSessions = [
  {
    id: 1,
    program_name: 'Push Day',
    duration_minutes: 45,
    perceived_effort: 7,
    started_at: '2026-07-27T10:00:00Z',
  },
  {
    id: 2,
    program_name: 'Pull Day',
    duration_minutes: 50,
    perceived_effort: 8,
    started_at: '2026-07-26T10:00:00Z',
  },
]

function setupAuth(user: any = mockUser) {
  mockUseAuth.mockReturnValue({ user, loading: false, logout: vi.fn() })
}

function setupApiResponses(overrides: Record<string, any> = {}) {
  const today = new Date().toISOString().split('T')[0]
  const defaultRecords = [
    { id: 1, calories: 300 },
    { id: 2, calories: 450 },
  ]
  mockGet.mockImplementation((url: string) => {
    if (url === '/training/programs') {
      return Promise.resolve({ data: { programs: [{ id: 1 }, { id: 2 }] } })
    }
    if (url === '/training/sessions') {
      return Promise.resolve({ data: { sessions: overrides.sessions || mockSessions } })
    }
    if (url.startsWith('/diet/records')) {
      return Promise.resolve({ data: { records: overrides.records || defaultRecords } })
    }
    return Promise.reject(new Error('Unknown URL'))
  })
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    setupApiResponses()
  })

  it('shows loading state initially', () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    expect(document.querySelector('.skeleton')).toBeInTheDocument()
  })

  it('renders user greeting', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText(/Hi, Test User/)).toBeInTheDocument()
    })
  })

  it('renders fitness goal info', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText(/Build Muscle/)).toBeInTheDocument()
    })

    expect(screen.getByText(/70 kg/)).toBeInTheDocument()
    expect(screen.getByText(/175 cm/)).toBeInTheDocument()
  })

  it('displays stat cards', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText('Training Programs')).toBeInTheDocument()
      // "Recent Sessions" appears both as a stat-card label and a section header
      expect(screen.getAllByText('Recent Sessions').length).toBeGreaterThan(0)
      expect(screen.getByText("Today's Calories")).toBeInTheDocument()
    })
  })

  it('calculates today calories correctly from string values', async () => {
    setupApiResponses({
      records: [
        { id: 1, calories: '300' },
        { id: 2, calories: '450' },
      ],
    })

    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText('750')).toBeInTheDocument()
    })
  })

  it('shows quick action links', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('New Program')).toBeInTheDocument()
      expect(screen.getByText('Log Meal')).toBeInTheDocument()
    })
  })

  it('shows recent training sessions', async () => {
    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText('Push Day')).toBeInTheDocument()
      expect(screen.getByText('Pull Day')).toBeInTheDocument()
    })

    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('50 min')).toBeInTheDocument()
    expect(screen.getByText('Effort: 7/10')).toBeInTheDocument()
    expect(screen.getByText('Effort: 8/10')).toBeInTheDocument()
  })

  it('shows no sessions message when empty', async () => {
    setupApiResponses({ sessions: [] })

    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText(/No training sessions yet/)).toBeInTheDocument()
    })
  })

  it('handles API errors', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Failed to load dashboard' } } })

    render(<DashboardPage />, { wrapper: MemoryRouter })

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
    })
  })
})