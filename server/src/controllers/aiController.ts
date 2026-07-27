import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { chatCompletion, TRAINING_SYSTEM_PROMPT, DIET_SYSTEM_PROMPT } from '../services/deepseek'

export const trainingAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const userResult = await pool.query(
      `SELECT name, age, weight_kg, height_cm, fitness_goal
       FROM users WHERE id = $1`,
      [req.userId!]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = userResult.rows[0]

    const sessionResult = await pool.query(
      `SELECT ts.started_at, ts.duration_minutes, ts.perceived_effort, ts.notes,
              tp.name as program_name
       FROM training_sessions ts
       LEFT JOIN training_programs tp ON ts.program_id = tp.id
       WHERE ts.user_id = $1
         AND ts.started_at >= NOW() - INTERVAL '30 days'
       ORDER BY ts.started_at DESC
       LIMIT 30`,
      [req.userId!]
    )

    const programResult = await pool.query(
      `SELECT tp.name, tp.difficulty, tp.target_muscle_group, COUNT(e.id) as exercise_count
       FROM training_programs tp
       LEFT JOIN exercises e ON tp.id = e.program_id
       WHERE tp.user_id = $1 AND tp.is_active = TRUE
       GROUP BY tp.id`,
      [req.userId!]
    )

    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Goal: ${user.fitness_goal ?? 'general'}

## Active Training Programs
${programResult.rows.length > 0
        ? programResult.rows.map((p: any) =>
          `- **${p.name}** — ${p.difficulty}, target: ${p.target_muscle_group ?? 'full body'}, ${p.exercise_count} exercises`
        ).join('\n')
        : '- No active programs'}

## Recent Training Sessions (last 30 days)
${sessionResult.rows.length > 0
        ? sessionResult.rows.map((s: any) =>
          `- ${new Date(s.started_at).toLocaleDateString()}: ${s.program_name ?? 'Freestyle workout'}, ${s.duration_minutes ?? '?'} min, effort ${s.perceived_effort ?? '?'}/10${s.notes ? ` — ${s.notes}` : ''}`
        ).join('\n')
        : '- No training sessions recorded'}

## Instructions
Please analyze this training data and provide:

1. **Frequency Assessment** — Is the training frequency appropriate for the goal? Too much or too little?
2. **Volume & Intensity** — Evaluate sets, reps, and progression patterns
3. **Muscle Group Balance** — Are any muscle groups being neglected or over-trained?
4. **Key Issues** — Identify 3-5 specific problems with concrete solutions
5. **Weekly Plan Suggestion** — Outline a sample week of training that fits this user's goal
`

    const analysis = await chatCompletion(userPrompt, TRAINING_SYSTEM_PROMPT)

    await pool.query(
      `INSERT INTO ai_analyses (user_id, analysis_type, request_data, response_text)
       VALUES ($1, 'training', $2, $3)`,
      [
        req.userId!,
        JSON.stringify({ sessionsCount: sessionResult.rows.length, programsCount: programResult.rows.length }),
        analysis,
      ]
    )

    res.json({ analysis, generatedAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Training analysis error:', err)

    if (err.message?.includes('DeepSeek')) {
      res.status(502).json({ error: 'AI service unavailable: ' + err.message })
      return
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}

export const dietRecommendation = async (req: AuthRequest, res: Response) => {
  try {
    const userResult = await pool.query(
      `SELECT name, age, weight_kg, height_cm, fitness_goal
       FROM users WHERE id = $1`,
      [req.userId!]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = userResult.rows[0]

    const dietResult = await pool.query(
      `SELECT meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, recorded_at
       FROM diet_records
       WHERE user_id = $1 AND recorded_at >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY recorded_at DESC, created_at DESC
       LIMIT 50`,
      [req.userId!]
    )

    const dailyResult = await pool.query(
      `SELECT
         recorded_at,
         COALESCE(SUM(calories), 0) as daily_calories,
         COALESCE(SUM(protein_grams), 0) as daily_protein,
         COALESCE(SUM(carbs_grams), 0) as daily_carbs,
         COALESCE(SUM(fat_grams), 0) as daily_fat
       FROM diet_records
       WHERE user_id = $1 AND recorded_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY recorded_at
       ORDER BY recorded_at DESC`,
      [req.userId!]
    )

    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Fitness Goal: ${user.fitness_goal ?? 'general'}

## Daily Calorie/Macro Totals (last 7 days)
${dailyResult.rows.length > 0
        ? dailyResult.rows.map((d: any) =>
          `- ${d.recorded_at}: ${d.daily_calories} kcal | P:${d.daily_protein}g C:${d.daily_carbs}g F:${d.daily_fat}g`
        ).join('\n')
        : '- No diet records'}

## Recent Meals
${dietResult.rows.length > 0
        ? dietResult.rows.map((r: any) =>
          `- [${r.meal_type}] ${r.food_name} — ${r.calories ?? '?'} kcal${r.protein_grams ? `, ${r.protein_grams}g protein` : ''}`
        ).join('\n')
        : '- No meals recorded'}

## Instructions
Based on the user's profile, fitness goal, and eating patterns, provide:

1. **Calorie Assessment** — Are they eating enough? Too much? Compare to their goal.
2. **Macro Balance** — Protein, carbs, fat breakdown — what needs to change?
3. **Meal Timing** — Are meals distributed well through the day?
4. **Key Issues** — 3-5 specific problems with their current diet
5. **3-Day Meal Plan** — A sample 3-day meal plan with specific foods, portions, and macro estimates. Include breakfast, lunch, dinner, and snacks for each day. Tailor to their fitness goal.
`

    const recommendation = await chatCompletion(userPrompt, DIET_SYSTEM_PROMPT)

    await pool.query(
      `INSERT INTO ai_analyses (user_id, analysis_type, request_data, response_text)
       VALUES ($1, 'diet', $2, $3)`,
      [
        req.userId!,
        JSON.stringify({ dietEntries: dietResult.rows.length, dailySummaries: dailyResult.rows.length }),
        recommendation,
      ]
    )

    res.json({ recommendation, generatedAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Diet recommendation error:', err)

    if (err.message?.includes('DeepSeek')) {
      res.status(502).json({ error: 'AI service unavailable: ' + err.message })
      return
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query as any).type

    let query = 'SELECT id, analysis_type, response_text, created_at FROM ai_analyses WHERE user_id = $1'
    const params: any[] = [req.userId!]

    if (type && ['training', 'diet'].includes(type)) {
      query += ' AND analysis_type = $2'
      params.push(type)
    }

    query += ' ORDER BY created_at DESC LIMIT 20'

    const result = await pool.query(query, params)
    res.json({ analyses: result.rows })
  } catch (err) {
    console.error('Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
