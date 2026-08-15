CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INTEGER,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  fitness_goal VARCHAR(50) DEFAULT 'general' CHECK (fitness_goal IN ('weight_loss', 'muscle_gain', 'endurance', 'general')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE training_programs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  difficulty VARCHAR(50) DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  target_muscle_group VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sets INTEGER DEFAULT 3,
  reps INTEGER DEFAULT 10,
  weight_kg NUMERIC(6,1),
  rest_seconds INTEGER DEFAULT 60,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id INTEGER REFERENCES training_programs(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
  notes TEXT
);

CREATE TABLE diet_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name VARCHAR(300) NOT NULL,
  calories INTEGER,
  protein_grams NUMERIC(6,1),
  carbs_grams NUMERIC(6,1),
  fat_grams NUMERIC(6,1),
  portion_description VARCHAR(200),
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diet_user_date ON diet_records(user_id, recorded_at);

CREATE TABLE ai_analyses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('training', 'diet')),
  request_data JSONB,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
