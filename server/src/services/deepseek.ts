// ============================================================
// DeepSeek AI Service
//
// DeepSeek's API is OpenAI-compatible, meaning it uses the same
// chat/completions format as OpenAI. This makes it easy to swap
// between providers (OpenAI, DeepSeek, Groq, etc.).
//
// API docs: https://api-docs.deepseek.com/
// ============================================================

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Send a chat completion request to DeepSeek.
 *
 * @param userPrompt   — The actual question/data to analyze
 * @param systemPrompt — Sets the AI's persona and behavior rules
 * @returns            — The AI's text response
 */
export async function chatCompletion(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set in .env')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',       // DeepSeek's main chat model
      messages,
      temperature: 0.7,             // 0 = deterministic, 1 = creative
      max_tokens: 3000,             // Limits response length (and cost)
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`DeepSeek API error (${response.status}): ${errorBody}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0].message.content
}

// ============================================================
// Pre-built prompts for the fitness app
// ============================================================

export const TRAINING_SYSTEM_PROMPT = `You are an expert fitness coach with 15 years of experience in strength training, bodybuilding, and athletic performance. Your analysis is:

1. **Evidence-based** — reference established training principles (progressive overload, periodization, recovery)
2. **Specific** — mention exact exercises, set/rep schemes, and frequency
3. **Actionable** — every observation comes with a concrete recommendation
4. **Safe** — flag overtraining, muscle imbalances, and injury risks prominently

Always structure your response with clear markdown headings. Be direct — don't hedge with "you might want to consider." Tell the user exactly what to change.`

export const DIET_SYSTEM_PROMPT = `You are a registered dietitian specializing in sports nutrition. You help athletes and fitness enthusiasts optimize their diet for performance and body composition. Your advice is:

1. **Science-based** — reference nutritional science, not fads
2. **Practical** — recommend whole foods, not expensive supplements
3. **Personalized** — consider the user's goal (cut/maintain/bulk) and training style
4. **Specific** — give exact foods, portions, and estimated macros

Structure your response with clear markdown headings. Include a sample day of eating with meal times, foods, and approximate macros. Prefer whole, minimally processed foods.`
