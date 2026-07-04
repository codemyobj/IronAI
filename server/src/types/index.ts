// ============================================================
// Shared TypeScript interfaces used across the server
// These mirror the MySQL table structure and API request/response shapes
// ============================================================

// --- Database row types (match MySQL tables) ---

export interface UserRow {
  id: number
  email: string
  password_hash: string
  name: string
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  fitness_goal: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
  created_at: Date
  updated_at: Date
}

// The safe user object returned to clients (no password_hash!)
export type SafeUser = Omit<UserRow, 'password_hash'>

export interface TrainingProgramRow {
  id: number
  user_id: number
  name: string
  description: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  target_muscle_group: string | null
  is_active: boolean
  created_at: Date
}

export interface ExerciseRow {
  id: number
  program_id: number
  name: string
  sets: number
  reps: number
  weight_kg: number | null
  rest_seconds: number
  notes: string | null
  sort_order: number
}

export interface TrainingSessionRow {
  id: number
  user_id: number
  program_id: number | null
  started_at: Date
  ended_at: Date | null
  duration_minutes: number | null
  perceived_effort: number | null
  notes: string | null
}

export interface DietRecordRow {
  id: number
  user_id: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories: number | null
  protein_grams: number | null
  carbs_grams: number | null
  fat_grams: number | null
  portion_description: string | null
  recorded_at: string // DATE in MySQL → 'YYYY-MM-DD' string
  created_at: Date
}

export interface AIAnalysisRow {
  id: number
  user_id: number
  analysis_type: 'training' | 'diet'
  request_data: any | null // JSON column
  response_text: string
  created_at: Date
}

// --- API request types ---

export interface RegisterBody {
  email: string
  password: string
  name: string
  age?: number
  height_cm?: number
  weight_kg?: number
  fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface LoginBody {
  email: string
  password: string
}

export interface CreateProgramBody {
  name: string
  description?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  target_muscle_group?: string
  exercises?: CreateExerciseBody[]
}

export interface CreateExerciseBody {
  name: string
  sets?: number
  reps?: number
  weight_kg?: number
  rest_seconds?: number
  notes?: string
}

export interface CreateSessionBody {
  program_id?: number
  duration_minutes?: number
  perceived_effort?: number
  notes?: string
}

export interface CreateDietBody {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories?: number
  protein_grams?: number
  carbs_grams?: number
  fat_grams?: number
  portion_description?: string
  recorded_at?: string // defaults to today
}
