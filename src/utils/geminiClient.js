async function callGemini(prompt, options = {}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY environment variable')

  const model = options.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  }

  // Optional config
  if (options.temperature !== undefined) body.generationConfig = { ...body.generationConfig, temperature: options.temperature }
  if (options.maxOutputTokens !== undefined) body.generationConfig = { ...body.generationConfig, maxOutputTokens: options.maxOutputTokens }
  if (options.thinkingBudget !== undefined) body.generationConfig = { ...body.generationConfig, thinkingConfig: { thinkingBudget: options.thinkingBudget } }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Gemini request failed: ${resp.status} ${resp.statusText} - ${errText}`)
  }

  const data = await resp.json()

  // Extract text safely
  const candidate = data?.candidates?.[0]
  if (candidate?.content?.parts) {
    return candidate.content.parts.map(p => p.text || '').join('').trim()
  }

  // Fallback
  return JSON.stringify(data)
}

export { callGemini }
export default callGemini

export async function fetchQuestion(difficulty = 'Easy') {
  const normalized = String(difficulty || 'Easy')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())

  const prompt = `Generate one ${normalized} full stack (React/Node) interview question. Return only the question text.`

  const text = await callGemini(prompt, { temperature: 0.2, maxOutputTokens: 256 })
  return (text || '').trim()
}
