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
// 分类错误类型，供 aiController 精确提示；保留 message 内包含 "DeepSeek"
// 以便现有 502 判断捕获。
export type DeepSeekErrorCode =
  | 'missing_key'        // DEEPSEEK_API_KEY 未配置
  | 'invalid_key'        // 401: key 无效/过期/撤销
  | 'quota_exceeded'     // 429: 额度耗尽/限流
  | 'upstream_5xx'       // DeepSeek 服务端 5xx
  | 'bad_request'        // 4xx 其他
  | 'network_error'      // fetch 层连不上（DNS/代理/超时）

export class DeepSeekError extends Error {
  code: DeepSeekErrorCode
  status?: number
  constructor(code: DeepSeekErrorCode, message: string, status?: number) {
    super(`[DeepSeek:${code}] ${message}`)
    this.name = 'DeepSeekError'
    this.code = code
    this.status = status
    // 兼容 aiController 现有的 err.message.includes('DeepSeek') 判断
    if (!message.includes('DeepSeek')) {
      this.message = `[DeepSeek:${code}] ${message}`
    }
  }

  toPublic(): string {
    switch (this.code) {
      case 'missing_key':
        return 'AI服务未配置。请在服务器 .env 文件中设置 DEEPSEEK_API_KEY。'
      case 'invalid_key':
        return '无效的 DeepSeek API Key。请在 https://platform.deepseek.com/api_keys 生成新密钥，并更新服务器 .env 中 DEEPSEEK_API_KEY。'
      case 'quota_exceeded':
        return 'DeepSeek 额度已耗尽或触发限流。请前往平台控制台检查余额与调用频率。'
      case 'upstream_5xx':
        return 'AI服务当前不可用（DeepSeek 服务端异常），请稍后重试。'
      case 'network_error':
        return 'AI服务当前不可用（无法连接 DeepSeek），请检查服务器网络/代理。'
      case 'bad_request':
      default:
        return 'AI服务处理请求失败，请稍后重试。'
    }
  }
}

export async function chatCompletion(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = (process.env.DEEPSEEK_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new DeepSeekError('missing_key', 'DEEPSEEK_API_KEY is not set in .env')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let response: Response
  try {
    response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
  } catch (err: any) {
    throw new DeepSeekError(
      'network_error',
      'Failed to reach DeepSeek API: ' + (err?.message ?? String(err)),
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const status = response.status

    // 尝试解析 DeepSeek 标准错误体
    let dsMessage = ''
    let dsCode: string | undefined
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string; type?: string } }
      dsMessage = parsed?.error?.message ?? ''
      dsCode = parsed?.error?.code ?? parsed?.error?.type ?? undefined
    } catch {
      dsMessage = text.slice(0, 300)
    }

    if (status === 401) {
      throw new DeepSeekError('invalid_key', dsMessage || 'Invalid API Key', status)
    }
    if (status === 429) {
      throw new DeepSeekError(
        'quota_exceeded',
        dsMessage || 'Rate limited or quota exceeded',
        status,
      )
    }
    if (status >= 500) {
      throw new DeepSeekError('upstream_5xx', dsMessage || 'Upstream 5xx', status)
    }
    // 其它 4xx 统一为 bad_request，但带上 DeepSeek 的说明
    throw new DeepSeekError(
      'bad_request',
      dsMessage || `HTTP ${status}`,
      status,
    )
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0].message.content
}

// ============================================================
// Language instruction — appended to system prompt
// ============================================================

const LANG_INSTRUCTIONS: Record<string, string> = {
  zh: '你必须使用简体中文来撰写整个分析报告，包括所有标题、描述和建议。',
  es: 'Debes escribir todo el informe de análisis en español, incluyendo todos los títulos, descripciones y recomendaciones.',
  en: 'Write the entire analysis report in English.',
}

/**
 * Get the language instruction for the given language code.
 * Falls back to English if the language is not supported.
 */
export function getLanguageInstruction(lang?: string): string {
  if (!lang) return LANG_INSTRUCTIONS.en
  const code = lang.split('-')[0].toLowerCase()
  return LANG_INSTRUCTIONS[code] ?? LANG_INSTRUCTIONS.en
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
