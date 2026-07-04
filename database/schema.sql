-- ============================================================
-- IronAI Database Schema
-- Run this SQL file to create all tables from scratch
--
-- How to run:
--   mysql -u root -p < database/schema.sql
--   (then enter your MySQL root password)
-- ============================================================

CREATE DATABASE IF NOT EXISTS ironai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ironai;

-- ============================================================
-- Users table — stores account information
-- ============================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash, NEVER plain text
  name VARCHAR(100) NOT NULL,
  age INT,
  height_cm DECIMAL(5,1),                       -- e.g. 178.5 cm
  weight_kg DECIMAL(5,1),                       -- e.g. 75.0 kg
  fitness_goal ENUM('lose_weight', 'build_muscle', 'endurance', 'general') DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- Training programs — reusable workout templates
-- ============================================================
CREATE TABLE training_programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  target_muscle_group VARCHAR(100),             -- e.g. "Chest & Triceps", "Legs"
  is_active BOOLEAN DEFAULT TRUE,               -- soft delete flag
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Exercises — individual movements within a training program
-- ============================================================
CREATE TABLE exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,                   -- e.g. "Bench Press", "Squat"
  sets INT DEFAULT 3,
  reps INT DEFAULT 10,
  weight_kg DECIMAL(6,1),                       -- weight used (nullable = bodyweight)
  rest_seconds INT DEFAULT 60,                  -- rest between sets
  notes TEXT,                                   -- e.g. "Focus on slow negative"
  sort_order INT DEFAULT 0,                     -- display order in the program
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Training sessions — logged completed workouts
-- ============================================================
CREATE TABLE training_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  program_id INT,                               -- nullable: user might do a freestyle workout
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_minutes INT,
  perceived_effort INT CHECK (perceived_effort BETWEEN 1 AND 10),  -- RPE scale
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- Diet records — daily food/meal entries
-- ============================================================
CREATE TABLE diet_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
  food_name VARCHAR(300) NOT NULL,              -- e.g. "Chicken breast, 200g"
  calories INT,                                 -- kcal
  protein_grams DECIMAL(6,1),
  carbs_grams DECIMAL(6,1),
  fat_grams DECIMAL(6,1),
  portion_description VARCHAR(200),             -- e.g. "1 cup", "200g"
  recorded_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create an index for fast date-range queries (used by summary endpoint)
CREATE INDEX idx_diet_user_date ON diet_records(user_id, recorded_at);

-- ============================================================
-- AI analyses — cached AI responses
-- ============================================================
CREATE TABLE ai_analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  analysis_type ENUM('training', 'diet') NOT NULL,
  request_data JSON,                            -- what we sent to the AI (for debugging)
  response_text TEXT NOT NULL,                  -- AI's response (markdown)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
