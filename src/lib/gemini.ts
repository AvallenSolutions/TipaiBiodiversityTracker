import type { AISuggestion, SightingCategory } from '@/types'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export function isGeminiAvailable(): boolean {
  return !!API_KEY
}

export async function identifySpecies(
  imageBlob: Blob,
  category: SightingCategory
): Promise<AISuggestion[]> {
  if (!API_KEY || !navigator.onLine) return []

  const base64 = await blobToBase64(imageBlob)
  const base64Data = base64.split(',')[1]

  const prompt = `You are a biodiversity expert specializing in Indian wildlife, particularly species found in forested estates near tiger reserves.

Analyze this image of a ${category} sighting.

Return a JSON array of up to 3 candidate species identifications, ranked by confidence. Each entry must have this structure:
{
  "species": "Common name",
  "common_name": "Common name",
  "scientific_name": "Scientific name (genus species)",
  "confidence": 0.0 to 1.0,
  "description": "Brief 1-2 sentence description",
  "category": "${category}"
}

If you cannot identify anything, return a single entry with confidence 0 and species "Unidentified".
Return ONLY the JSON array, no other text.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: imageBlob.type, data: base64Data } },
          ],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }

  return [{
    species: 'Unidentified',
    common_name: 'Unidentified',
    scientific_name: null,
    confidence: 0,
    description: text,
    category,
  }]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
