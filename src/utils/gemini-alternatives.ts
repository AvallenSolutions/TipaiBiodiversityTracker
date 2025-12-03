import { AIIdentification, CategoryType } from '../types/sighting'

// Alternative AI Providers Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const GOOGLE_CLOUD_VISION_KEY = import.meta.env.VITE_GOOGLE_CLOUD_VISION_KEY

// Determine which provider to use (priority: Gemini > OpenAI > Google Vision)
const AI_PROVIDER = GEMINI_API_KEY ? 'gemini' : OPENAI_API_KEY ? 'openai' : GOOGLE_CLOUD_VISION_KEY ? 'vision' : null

export async function identifySpecies(
  imageBlob: Blob,
  category: CategoryType
): Promise<AIIdentification> {
  if (!AI_PROVIDER) {
    return {
      species: null,
      common_name: null,
      confidence: 0,
      description: 'AI identification not available (no API key configured)'
    }
  }

  try {
    switch (AI_PROVIDER) {
      case 'gemini':
        return await identifyWithGemini(imageBlob, category)
      case 'openai':
        return await identifyWithOpenAI(imageBlob, category)
      case 'vision':
        return await identifyWithGoogleVision(imageBlob, category)
      default:
        throw new Error('No AI provider configured')
    }
  } catch (error) {
    console.error('AI identification error:', error)
    return {
      species: null,
      common_name: null,
      confidence: 0,
      description: `AI identification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Gemini 2.0 Flash Provider
async function identifyWithGemini(imageBlob: Blob, category: CategoryType): Promise<AIIdentification> {
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
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

// OpenAI GPT-4 Vision Provider
async function identifyWithOpenAI(imageBlob: Blob, category: CategoryType): Promise<AIIdentification> {
  const base64Image = await blobToBase64(imageBlob)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a biodiversity expert. Identify this ${category} from India. Respond in JSON format:
{
  "species": "Scientific name",
  "common_name": "Common name",
  "confidence": 0-100,
  "description": "Brief description"
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 500
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.choices[0].message.content

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

// Google Cloud Vision API Provider
async function identifyWithGoogleVision(imageBlob: Blob, category: CategoryType): Promise<AIIdentification> {
  const base64Image = await blobToBase64(imageBlob)
  const base64Data = base64Image.split(',')[1]

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 5 },
              { type: 'WEB_DETECTION', maxResults: 5 }
            ]
          }
        ]
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Google Vision API error: ${response.statusText}`)
  }

  const data = await response.json()
  const labels = data.responses[0]?.labelAnnotations || []
  const webEntities = data.responses[0]?.webDetection?.webEntities || []

  const topLabel = labels[0]?.description || 'Unknown'
  const confidence = labels[0]?.score ? Math.round(labels[0].score * 100) : 0

  const webMatch = webEntities.find((entity: any) =>
    entity.description && entity.description.toLowerCase().includes(category.toLowerCase())
  )

  return {
    species: webMatch?.description || null,
    common_name: topLabel,
    confidence: confidence,
    description: `Detected as ${topLabel}. ${labels.slice(0, 3).map((l: any) => l.description).join(', ')}`
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
