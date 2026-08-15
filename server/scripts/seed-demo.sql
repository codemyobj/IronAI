-- ============================================================
-- 首次启动本地 PostgreSQL 时的示例数据。
-- 用户数据不会与远程 Supabase 同步，所以在这里准备一个
-- 可直接登录的演示账号 + 演示训练计划 / 饮食记录。
-- ============================================================
-- 登录信息：
--   邮箱:  demo@ironai.local
--   密码:  demo123
--   (哈希由 bcryptjs 生成, rounds=10)
-- ============================================================

INSERT INTO users (email, password_hash, name, age, height_cm, weight_kg, fitness_goal)
VALUES (
  'demo@ironai.local',
  '$2a$10$EgYv7wG5q4mQwXs4r2Fz8OQb0VxXq6hVb0Yv0M0L5Xq0Tf9e4W6yK', -- demo123
  '演示用户',
  28,
  175.0,
  70.0,
  'general'
)
ON CONFLICT (email) DO NOTHING;

-- 演示训练计划
WITH new_user AS (SELECT id FROM users WHERE email = 'demo@ironai.local')
INSERT INTO training_programs (user_id, name, description, difficulty, target_muscle_group, is_active)
SELECT id, '新手全身训练', '适合初学者的全身训练，每周 3 次', 'beginner', '全身', TRUE
FROM new_user
ON CONFLICT DO NOTHING;

-- 演示动作（关联上面的计划）
WITH
  usr  AS (SELECT id AS user_id FROM users WHERE email = 'demo@ironai.local'),
  prog AS (SELECT id AS program_id FROM training_programs, usr
           WHERE training_programs.user_id = usr.user_id AND name = '新手全身训练' LIMIT 1)
INSERT INTO exercises (program_id, name, sets, reps, weight_kg, rest_seconds, sort_order)
SELECT program_id, '深蹲',     3, 12, CAST(NULL AS numeric), 60, 1 FROM prog UNION ALL
SELECT program_id, '卧推',     3, 10, CAST(NULL AS numeric), 60, 2 FROM prog UNION ALL
SELECT program_id, '硬拉',     3,  8, CAST(NULL AS numeric), 90, 3 FROM prog UNION ALL
SELECT program_id, '引体向上', 3,  8, CAST(NULL AS numeric), 60, 4 FROM prog UNION ALL
SELECT program_id, '平板支撑', 3, 60, CAST(NULL AS numeric), 45, 5 FROM prog;

-- 演示近 7 天的饮食记录（凑 2200kcal 左右/天）
WITH u AS (SELECT id AS user_id FROM users WHERE email = 'demo@ironai.local')
INSERT INTO diet_records (user_id, meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, recorded_at)
SELECT user_id, 'breakfast', '燕麦粥 + 鸡蛋 + 牛奶',          550, 30, 65, 18, CURRENT_DATE - i
FROM u, generate_series(0, 6) i
UNION ALL
SELECT user_id, 'lunch',     '糙米饭 + 鸡胸 + 西兰花',       800, 50, 90, 22, CURRENT_DATE - i
FROM u, generate_series(0, 6) i
UNION ALL
SELECT user_id, 'dinner',    '三文鱼 + 红薯 + 沙拉',         700, 40, 70, 25, CURRENT_DATE - i
FROM u, generate_series(0, 6) i
UNION ALL
SELECT user_id, 'snack',     '希腊酸奶 + 坚果',              180, 15, 15,  8, CURRENT_DATE - i
FROM u, generate_series(0, 6) i;

-- 演示最近 5 次训练课
WITH u AS (SELECT id AS user_id FROM users WHERE email = 'demo@ironai.local'),
     p AS (SELECT id AS program_id FROM training_programs, u
           WHERE training_programs.user_id = u.user_id AND name = '新手全身训练' LIMIT 1)
INSERT INTO training_sessions (user_id, program_id, started_at, duration_minutes, perceived_effort, notes)
SELECT user_id, program_id,
       NOW() - (i || ' day')::interval - ((3 - i) * 3600 || ' second')::interval,
       45 + i * 3,
       5 + (i % 3),
       CASE WHEN i = 0 THEN '今天的训练状态不错' ELSE '' END
FROM u, p, generate_series(0, 4) i;
