// ============================================================
// Shared TypeScript interfaces used across the server
// Row types now derived from Prisma generated types.
// Body interfaces remain hand-written for request validation.
// ============================================================

import type {
  User,
  TrainingProgram,
  Exercise,
  TrainingSession,
  DietRecord,
  AIAnalysis,
} from '@prisma/client'

// --- Database row types (derived from Prisma) ---

export type UserRow = User
export type SafeUser = Omit<User, 'password_hash'>
export type TrainingProgramRow = TrainingProgram
export type ExerciseRow = Exercise
export type TrainingSessionRow = TrainingSession
export type DietRecordRow = DietRecord
export type AIAnalysisRow = AIAnalysis

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
