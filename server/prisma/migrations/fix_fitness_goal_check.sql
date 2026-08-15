-- 更新 users.fitness_goal CHECK 约束
-- 旧值: lose_weight / build_muscle / endurance / general
-- 新值: general / weight_loss / muscle_gain / endurance

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_fitness_goal_check;

ALTER TABLE users ADD CONSTRAINT users_fitness_goal_check
  CHECK (fitness_goal IN ('general', 'weight_loss', 'muscle_gain', 'endurance'));

-- 将旧数据迁移到新值
UPDATE users SET fitness_goal = 'weight_loss' WHERE fitness_goal = 'lose_weight';
UPDATE users SET fitness_goal = 'muscle_gain' WHERE fitness_goal = 'build_muscle';
