-- 创建 body_measurements 表，用于记录用户的体重/体脂/肌肉/腰围历史数据
-- 用于 Body 页面的趋势图和最近记录

CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,1) NOT NULL,
  body_fat_pct NUMERIC(5,1),
  muscle_kg NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date
  ON body_measurements(user_id, measured_at);
