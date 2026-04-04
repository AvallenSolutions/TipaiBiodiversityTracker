import { AIIdentification } from '../types/sighting'
import { CategoryType } from '../types/database'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export async function identifySpecies(
  imageBlob: Blob,
  category: CategoryType
): Promise<AIIdentification> {
  if (!GEMINI_API_KEY) {
    // Return null if no API key - AI identification is optional
    return {
      species: null,
      common_name: null,
      confidence: 0,
      description: 'AI identification not available (API key not configured)'
    }
  }

  const base64Image = await blobToBase64(imageBlob)
  const base64Data = base64Image.split(',')[1]

  const prompt = `You are a biodiversity expert specializing in Indian wildlife.

Analyze this image of a ${category} spotted in a forest in India (likely near a tiger reserve).

Provide the following information in JSON format:
{
  "species": "Scientific name",
  "common_name": "Common name",
  "confidence": 0-100,
  "description": "Brief description of the species (2-3 sentences)",
  "suggested_category": "mammal|bird|lizard|insect|plant|trace|fungi"
}

If you cannot identify with confidence, provide your best guess with a lower confidence score.
For traces (footprints, scat, scratch marks), identify what animal made it.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: imageBlob.type,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates[0].content.parts[0].text

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }

  return {
    species: 'Unknown',
    common_name: 'Unable to identify',
    confidence: 0,
    description: text
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
