import { Response } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../middleware/auth'
import { chatCompletion, TRAINING_SYSTEM_PROMPT, DIET_SYSTEM_PROMPT } from '../services/deepseek'
import { formatDate } from '../utils/format'

export const trainingAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.userId! },
      select: {
        name: true,
        age: true,
        weight_kg: true,
        height_cm: true,
        fitness_goal: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const sessions = await prisma.trainingSession.findMany({
      where: {
        user_id: req.userId!,
        started_at: { gte: thirtyDaysAgo },
      },
      include: {
        program: { select: { name: true } },
      },
      orderBy: { started_at: 'desc' },
      take: 30,
    })

    // flatten program_name
    const sessionData = sessions.map(s => ({
      started_at: s.started_at,
      duration_minutes: s.duration_minutes,
      perceived_effort: s.perceived_effort,
      notes: s.notes,
      program_name: s.program?.name ?? null,
    }))

    const programs = await prisma.trainingProgram.findMany({
      where: { user_id: req.userId!, is_active: true },
      include: {
        _count: { select: { exercises: true } },
      },
    })

    const programData = programs.map(p => ({
      name: p.name,
      difficulty: p.difficulty,
      target_muscle_group: p.target_muscle_group,
      exercise_count: p._count.exercises,
    }))

    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Goal: ${user.fitness_goal ?? 'general'}

## Active Training Programs
${programData.length > 0
        ? programData.map((p) =>
          `- **${p.name}** — ${p.difficulty}, target: ${p.target_muscle_group ?? 'full body'}, ${p.exercise_count} exercises`
        ).join('\n')
        : '- No active programs'}

## Recent Training Sessions (last 30 days)
${sessionData.length > 0
        ? sessionData.map((s) =>
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

    await prisma.aIAnalysis.create({
      data: {
        user_id: req.userId!,
        analysis_type: 'training',
        request_data: {
          sessionsCount: sessionData.length,
          programsCount: programData.length,
        },
        response_text: analysis,
      },
    })

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
    const user = await prisma.user.findFirst({
      where: { id: req.userId! },
      select: {
        name: true,
        age: true,
        weight_kg: true,
        height_cm: true,
        fitness_goal: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dietRecords = await prisma.dietRecord.findMany({
      where: {
        user_id: req.userId!,
        recorded_at: { gte: sevenDaysAgo },
      },
      orderBy: [
        { recorded_at: 'desc' },
        { created_at: 'desc' },
      ],
      take: 50,
      select: {
        meal_type: true,
        food_name: true,
        calories: true,
        protein_grams: true,
        carbs_grams: true,
        fat_grams: true,
        recorded_at: true,
      },
    })

    const dailyAgg = await prisma.dietRecord.groupBy({
      by: ['recorded_at'],
      where: {
        user_id: req.userId!,
        recorded_at: { gte: sevenDaysAgo },
      },
      _sum: {
        calories: true,
        protein_grams: true,
        carbs_grams: true,
        fat_grams: true,
      },
      orderBy: { recorded_at: 'desc' },
    })

    const dailyData = dailyAgg.map(d => ({
      recorded_at: formatDate(d.recorded_at),
      daily_calories: d._sum.calories ?? 0,
      daily_protein: d._sum.protein_grams ?? 0,
      daily_carbs: d._sum.carbs_grams ?? 0,
      daily_fat: d._sum.fat_grams ?? 0,
    }))

    const userPrompt = `
## User Profile
- Name: ${user.name}
- Age: ${user.age ?? 'Not specified'}
- Weight: ${user.weight_kg ? user.weight_kg + 'kg' : 'Not specified'}
- Height: ${user.height_cm ? user.height_cm + 'cm' : 'Not specified'}
- Fitness Goal: ${user.fitness_goal ?? 'general'}

## Daily Calorie/Macro Totals (last 7 days)
${dailyData.length > 0
        ? dailyData.map((d) =>
          `- ${d.recorded_at}: ${d.daily_calories} kcal | P:${d.daily_protein}g C:${d.daily_carbs}g F:${d.daily_fat}g`
        ).join('\n')
        : '- No diet records'}

## Recent Meals
${dietRecords.length > 0
        ? dietRecords.map((r) =>
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

    await prisma.aIAnalysis.create({
      data: {
        user_id: req.userId!,
        analysis_type: 'diet',
        request_data: {
          dietEntries: dietRecords.length,
          dailySummaries: dailyData.length,
        },
        response_text: recommendation,
      },
    })

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

    const where: any = { user_id: req.userId! }
    if (type && ['training', 'diet'].includes(type)) {
      where.analysis_type = type
    }

    const analyses = await prisma.aIAnalysis.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        analysis_type: true,
        response_text: true,
        created_at: true,
      },
    })

    res.json({ analyses })
  } catch (err) {
    console.error('Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
