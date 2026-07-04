// ============================================================
// AI Controller — training analysis & diet recommendations
//
// Flow:
// 1. Fetch user profile + relevant data from MySQL
// 2. Build a detailed prompt with that data
// 3. Send to DeepSeek API
// 4. Save the response to the ai_analyses table
// 5. Return the response to the client
// ============================================================

import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { chatCompletion, TRAINING_SYSTEM_PROMPT, DIET_SYSTEM_PROMPT } from '../services/deepseek'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

// ============================================================
// POST /api/ai/training-analysis
// ============================================================
export const trainingAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Fetch user profile
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT name, age, weight_kg, height_cm, fitness_goal
       FROM users WHERE id = ?`,
      [req.userId!]
    )

    if (userRows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = userRows[0]

    // 2. Fetch recent training sessions (last 30 days)
    const [sessionRows] = await pool.query<RowDataPacket[]>(
      `SELECT ts.started_at, ts.duration_minutes, ts.perceived_effort, ts.notes,
              tp.name as program_name
       FROM training_sessions ts
       LEFT JOIN training_programs tp ON ts.program_id = tp.id
       WHERE ts.user_id = ?
         AND ts.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY ts.started_at DESC
       LIMIT 30`,
      [req.userId!]
    )

    // 3. Fetch active training programs with exercise counts
    const [programRows] = await pool.query<RowDataPacket[]>(
      `SELECT tp.name, tp.difficulty, tp.target_muscle_group, COUNT(e.id) as exercise_count
       FROM training_programs tp
       LEFT JOIN exercises e ON tp.id = e.program_id
       WHERE tp.user_id = ? AND tp.is_active = TRUE
       GROUP BY tp.id`,
      [req.userId!]
    )

    // 4. Build the user prompt
    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Goal: ${user.fitness_goal ?? 'general'}

## Active Training Programs
${programRows.length > 0
        ? programRows.map((p: any) =>
          `- **${p.name}** — ${p.difficulty}, target: ${p.target_muscle_group ?? 'full body'}, ${p.exercise_count} exercises`
        ).join('\n')
        : '- No active programs'}

## Recent Training Sessions (last 30 days)
${sessionRows.length > 0
        ? sessionRows.map((s: any) =>
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

    // 5. Call DeepSeek
    const analysis = await chatCompletion(userPrompt, TRAINING_SYSTEM_PROMPT)

    // 6. Save to database
    await pool.query<ResultSetHeader>(
      `INSERT INTO ai_analyses (user_id, analysis_type, request_data, response_text)
       VALUES (?, 'training', ?, ?)`,
      [
        req.userId!,
        JSON.stringify({ sessionsCount: sessionRows.length, programsCount: programRows.length }),
        analysis,
      ]
    )

    // 7. Return to client
    res.json({ analysis, generatedAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Training analysis error:', err)

    // If DeepSeek API fails, give a clear error
    if (err.message?.includes('DeepSeek')) {
      res.status(502).json({ error: 'AI service unavailable: ' + err.message })
      return
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// POST /api/ai/diet-recommendation
// ============================================================
export const dietRecommendation = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Fetch user profile
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT name, age, weight_kg, height_cm, fitness_goal
       FROM users WHERE id = ?`,
      [req.userId!]
    )

    if (userRows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = userRows[0]

    // 2. Fetch diet records from last 7 days
    const [dietRows] = await pool.query<RowDataPacket[]>(
      `SELECT meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, recorded_at
       FROM diet_records
       WHERE user_id = ? AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY recorded_at DESC, created_at DESC
       LIMIT 50`,
      [req.userId!]
    )

    // 3. Get daily calorie/macro totals for the last 7 days
    const [dailyTotals] = await pool.query<RowDataPacket[]>(
      `SELECT
         recorded_at,
         COALESCE(SUM(calories), 0) as daily_calories,
         COALESCE(SUM(protein_grams), 0) as daily_protein,
         COALESCE(SUM(carbs_grams), 0) as daily_carbs,
         COALESCE(SUM(fat_grams), 0) as daily_fat
       FROM diet_records
       WHERE user_id = ? AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY recorded_at
       ORDER BY recorded_at DESC`,
      [req.userId!]
    )

    // 4. Build the prompt
    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Fitness Goal: ${user.fitness_goal ?? 'general'}

## Daily Calorie/Macro Totals (last 7 days)
${dailyTotals.length > 0
        ? dailyTotals.map((d: any) =>
          `- ${d.recorded_at}: ${d.daily_calories} kcal | P:${d.daily_protein}g C:${d.daily_carbs}g F:${d.daily_fat}g`
        ).join('\n')
        : '- No diet records'}

## Recent Meals
${dietRows.length > 0
        ? dietRows.map((r: any) =>
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

    // 5. Call DeepSeek
    const recommendation = await chatCompletion(userPrompt, DIET_SYSTEM_PROMPT)

    // 6. Save to database
    await pool.query<ResultSetHeader>(
      `INSERT INTO ai_analyses (user_id, analysis_type, request_data, response_text)
       VALUES (?, 'diet', ?, ?)`,
      [
        req.userId!,
        JSON.stringify({ dietEntries: dietRows.length, dailySummaries: dailyTotals.length }),
        recommendation,
      ]
    )

    // 7. Return to client
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

// ============================================================
// GET /api/ai/history — get past analyses
// ============================================================
export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query as any).type // optional filter: 'training' or 'diet'

    let query = 'SELECT id, analysis_type, response_text, created_at FROM ai_analyses WHERE user_id = ?'
    const params: any[] = [req.userId!]

    if (type && ['training', 'diet'].includes(type)) {
      query += ' AND analysis_type = ?'
      params.push(type)
    }

    query += ' ORDER BY created_at DESC LIMIT 20'

    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    res.json({ analyses: rows })
  } catch (err) {
    console.error('Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
