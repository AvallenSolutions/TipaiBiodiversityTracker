import type { AISuggestion, SightingCategory } from '@/types'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-flash-latest'

const CATEGORY_VALUES = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace'] as const

export function isGeminiAvailable(): boolean {
  return !!API_KEY
}

export async function identifySpecies(
  imageBlob: Blob,
  category: SightingCategory | null
): Promise<AISuggestion[]> {
  if (!API_KEY || !navigator.onLine) return []

  const base64 = await blobToBase64(imageBlob)
  const base64Data = base64.split(',')[1]

  const categoryClause = category
    ? `The user has pre-classified this as a ${category} sighting — your candidates must all fall in that category.`
    : `Determine the most likely category for each candidate from: ${CATEGORY_VALUES.join(', ')}.`

  const prompt = `You are an expert field biologist focused on Indian wildlife, particularly species occurring in forested estates near tiger reserves (e.g. Tipai, adjoining Pench / Tadoba landscapes).

The image may be a live photograph or a photograph of a printed plate from a field guide — in either case, identify the subject from visible field marks (markings, plumage, leaf shape, body proportions, posture, habitat).

${categoryClause}

Always return your top 3 best guesses ranked by confidence, even when confidence is moderate. Use the standard English common name and the binomial scientific name. Confidence is your subjective probability between 0.0 and 1.0.

Only return a single "Unidentified" record (confidence 0) if the image is genuinely unusable — blank, blurred beyond recognition, or contains no biological subject. Do NOT use "Unidentified" just because identification is hard.`

  const responseSchema = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        common_name: { type: 'STRING' },
        scientific_name: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
        description: { type: 'STRING' },
        category: { type: 'STRING', enum: [...CATEGORY_VALUES] },
      },
      required: ['common_name', 'scientific_name', 'confidence', 'description', 'category'],
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: imageBlob.type || 'image/jpeg', data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('[Gemini] API error', response.status, response.statusText, body)
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]
  const finishReason = candidate?.finishReason
  const text: string = candidate?.content?.parts?.[0]?.text ?? ''

  console.debug('[Gemini] response', { finishReason, text, raw: data })

  if (!candidate) {
    console.warn('[Gemini] no candidates in response', data)
    return []
  }
  if (finishReason && finishReason !== 'STOP') {
    console.warn('[Gemini] non-STOP finishReason:', finishReason, data)
  }

  const parsed = tryParseJsonArray(text)
  if (!parsed || parsed.length === 0) {
    console.warn('[Gemini] could not parse suggestions, raw text:', text)
    return [{
      species: 'Unidentified',
      common_name: 'Unidentified',
      scientific_name: null,
      confidence: 0,
      description: text.slice(0, 240) || 'No response from model',
      category: category ?? undefined,
    }]
  }

  return parsed.map(toSuggestion(category))
}

function tryParseJsonArray(text: string): unknown[] | null {
  if (!text) return null
  const direct = safeParse(text)
  if (Array.isArray(direct)) return direct
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    const fallback = safeParse(match[0])
    if (Array.isArray(fallback)) return fallback
  }
  return null
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

function toSuggestion(fallbackCategory: SightingCategory | null) {
  return (raw: unknown): AISuggestion => {
    const r = (raw ?? {}) as Record<string, unknown>
    const common = (r.common_name as string) ?? (r.species as string) ?? null
    const scientific = (r.scientific_name as string) ?? null
    const confidence = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence) || 0
    const description = (r.description as string) ?? ''
    const cat = r.category as SightingCategory | undefined
    return {
      species: common,
      common_name: common,
      scientific_name: scientific,
      confidence,
      description,
      category: cat ?? fallbackCategory ?? undefined,
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
