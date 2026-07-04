export interface RegisterData {
    email: string
    password: string
    name: string
    age?: number
    height_cm?: number
    weight_kg?: number
    fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface User {
    id: number
    email: string
    name: string
    age?: number
    height_cm?: number
    weight_kg?: number
    fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface TrainingProgram {
    id: number
    user_id: number
    name: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    target_muscle_group: string
    exercises: Exercise[]
}

export interface Exercise {
    id: number
    program_id: number
    name: string
    sets: number
    reps: number
    weight_kg: number
    rest_seconds: number
}

export interface DietRecord {
    id: number;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    food_name: string;
    calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
    portion_description?: string;
    recorded_at: string;
}

export interface AIAnalysis {
    id: number;
    analysis_type: 'training' | 'diet';
    response_text: string;
    created_at: string;
}