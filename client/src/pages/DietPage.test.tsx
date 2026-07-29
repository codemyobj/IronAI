import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DietPage from '../pages/DietPage'

const mockUseDiet = vi.fn()

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockRecords = [
  {
    id: 1,
    meal_type: 'breakfast',
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
    meal_type: 'lunch',
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

vi.mock('../hooks/useDiet', () => ({
  useDiet: () => mockUseDiet(),
}))

function setupMock(overrides: Record<string, any> = {}) {
  const defaults = {
    records: mockRecords,
    selectedDate: '2026-07-27',
    setSelectedDate: vi.fn(),
    summary: mockSummary,
    dailyBreakdown: mockDaily,
    loading: false,
    error: '',
    addRecord: vi.fn().mockResolvedValue({ id: 3 }),
    deleteRecord: vi.fn().mockResolvedValue({}),
  }
  mockUseDiet.mockReturnValue({ ...defaults, ...overrides })
}

describe('DietPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMock()
  })

  it('renders diet page with records', () => {
    render(<DietPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('Diet Tracker')).toBeInTheDocument()
    expect(screen.getByText('Oatmeal')).toBeInTheDocument()
    expect(screen.getByText('Chicken Salad')).toBeInTheDocument()
  })

  it('displays calorie and macro totals', () => {
    const { container } = render(<DietPage />, { wrapper: MemoryRouter })

    const macroValues = container.querySelectorAll('.macro-value')
    const calorieValue = Array.from(macroValues).find(el => el.textContent?.trim() === '750')
    expect(calorieValue).toBeDefined()

    expect(screen.getByText('45.0g')).toBeInTheDocument()
  })

  it('handles string numeric values from DB', () => {
    setupMock({
      records: [
        { ...mockRecords[0], calories: '300', protein_grams: '10', carbs_grams: '50', fat_grams: '5' },
        { ...mockRecords[1], calories: '450', protein_grams: '35', carbs_grams: '20', fat_grams: '15' },
      ],
    })
    const { container } = render(<DietPage />, { wrapper: MemoryRouter })

    const macroValues = container.querySelectorAll('.macro-value')
    const calorieValue = Array.from(macroValues).find(el => el.textContent?.trim() === '750')
    expect(calorieValue).toBeDefined()

    expect(screen.getByText('45.0g')).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    setupMock({ records: [] })
    render(<DietPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('No meals logged for this day.')).toBeInTheDocument()
    expect(screen.getByText(/Tap.*Add Food.*start tracking/)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    setupMock({ loading: true, records: [] })
    render(<DietPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('Loading diet records...')).toBeInTheDocument()
  })

  it('shows error message', () => {
    setupMock({ error: 'Network error' })
    render(<DietPage />, { wrapper: MemoryRouter })

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('opens add food modal', async () => {
    render(<DietPage />, { wrapper: MemoryRouter })

    const addButton = screen.getByText('+ Add Food')
    await userEvent.click(addButton)

    expect(screen.getByText('Add Food Entry')).toBeInTheDocument()
    expect(screen.getByText('Meal Type *')).toBeInTheDocument()
    expect(screen.getByText('Food Name *')).toBeInTheDocument()
  })

  it('submits add food form', async () => {
    const mockAddRecord = vi.fn().mockResolvedValue({ id: 3 })
    setupMock({ addRecord: mockAddRecord })

    render(<DietPage />, { wrapper: MemoryRouter })

    await userEvent.click(screen.getByText('+ Add Food'))

    const foodInput = screen.getByPlaceholderText('e.g. Grilled Chicken Breast')
    await userEvent.type(foodInput, 'Salmon')

    const calorieInput = screen.getByPlaceholderText('350')
    await userEvent.type(calorieInput, '500')

    const proteinInput = screen.getByPlaceholderText('30')
    await userEvent.type(proteinInput, '40')

    const submitButton = screen.getByText('Add Food')
    await userEvent.click(submitButton)

    expect(mockAddRecord).toHaveBeenCalledWith(expect.objectContaining({
      food_name: 'Salmon',
      calories: 500,
      protein_grams: 40,
    }))
  })

  it('shows validation error when food name is empty', async () => {
    render(<DietPage />, { wrapper: MemoryRouter })

    await userEvent.click(screen.getByText('+ Add Food'))

    const submitButton = screen.getByText('Add Food')
    await userEvent.click(submitButton)

    expect(screen.getByText('Food name is required')).toBeInTheDocument()
  })

  it('renders weekly summary section', () => {
    render(<DietPage />, { wrapper: MemoryRouter })

    expect(screen.getByText("This Week's Overview")).toBeInTheDocument()
    expect(screen.getByText(/Total protein:/)).toBeInTheDocument()
  })

  it('handles delete record', async () => {
    const mockDeleteRecord = vi.fn().mockResolvedValue({})
    setupMock({ deleteRecord: mockDeleteRecord })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DietPage />, { wrapper: MemoryRouter })

    const deleteButtons = screen.getAllByText('✕')
    fireEvent.click(deleteButtons[0])

    expect(confirmSpy).toHaveBeenCalledWith('Delete this food entry?')
    expect(mockDeleteRecord).toHaveBeenCalledWith(1)

    confirmSpy.mockRestore()
  })
})