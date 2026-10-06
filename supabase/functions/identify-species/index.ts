// identify-species: server-side species identification for the field app.
//
// Why server-side: the Gemini key no longer ships to every phone, we can
// retry and fall back when Google is busy, and we can ground the model in
// our own data (species library, field-guide plates, confirmed Tipai photos,
// naturalist look-alike tips).
//
// Actions (POST JSON, signed-in users only):
//   { action: 'identify', images, category?, latitude?, longitude?, park?, sighted_at?, exclude_sighting_id? }
//       Two-pass identification. Pass 1 shortlists 5 library candidates using
//       context and the most similar confirmed Tipai photos. Pass 2 compares
//       the photo side by side with field-guide plates and confirmed photos
//       of each candidate, then ranks the top 3 with the field marks it used.
//   { action: 'learn', sighting_id, image }
//       Naturalists/admins only. Stores a thumbnail of a confirmed sighting
//       and its embedding in species_examples so future identifications can
//       find it. Removes the example if the sighting is rejected or unnamed.
//
// Secrets: GEMINI_API_KEY (required), SITE_URL (app origin, for field-guide
// plates), GEMINI_MODEL / GEMINI_FALLBACK_MODEL (optional overrides).

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { decodeBase64, encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { buildPlateIndex, findPlate } from '../_shared/speciesPlates.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')

// Pinned models (no "-latest" aliases: those move without warning and the
// newest model is usually the busiest). Fallback is a different generation
// so a capacity spike on one is unlikely to hit both.
const PRIMARY_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash'
const EMBED_MODEL = 'gemini-embedding-2'
const EMBED_DIMS = 768
const ENGINE = 'v2'

const BUCKET = 'sighting-media'
const CATEGORIES = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace'] as const
type Category = typeof CATEGORIES[number]

const MAX_QUERY_IMAGES = 3
const MAX_IMAGE_B64 = 4_000_000          // ~3 MB per image after base64
const MAX_LEARN_B64 = 1_500_000
const TIME_BUDGET_MS = 110_000           // stay well inside the edge wall-clock limit
const RETRYABLE = new Set([429, 500, 502, 503, 504])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Small helpers ────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

interface InlineImage { mime_type: string; data: string }

function inline(img: InlineImage) {
  return { inline_data: { mime_type: img.mime_type, data: img.data } }
}

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

async function fetchImage(url: string): Promise<InlineImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > 1_500_000) return null // reference images should be thumbnails
    return { mime_type: type.split(';')[0]!, data: encodeBase64(bytes) }
  } catch {
    return null
  }
}

// ─── Gemini calls with retry + model fallback ────────────────────────

class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// `first` lets pass 2 start on whichever model answered pass 1, so a busy
// primary model is not retried all over again.
async function generate(body: unknown, deadline: number, first = PRIMARY_MODEL): Promise<{ data: any; model: string }> {
  const payload = JSON.stringify(body)
  let lastErr: unknown = null
  const order = first === FALLBACK_MODEL ? [FALLBACK_MODEL, PRIMARY_MODEL] : [PRIMARY_MODEL, FALLBACK_MODEL]
  for (const model of order) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining < 5000) break
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: payload,
            signal: AbortSignal.timeout(Math.min(60_000, remaining)),
          },
        )
        if (res.ok) return { data: await res.json(), model }
        const text = (await res.text().catch(() => '')).slice(0, 300)
        lastErr = new GeminiError(res.status, text)
        console.warn(`[gemini] ${model} attempt ${attempt + 1} -> ${res.status} ${text}`)
        if (res.status === 404) break             // model retired: go to the fallback
        if (!RETRYABLE.has(res.status)) throw lastErr
      } catch (err) {
        if (err instanceof GeminiError && !RETRYABLE.has(err.status) && err.status !== 404) throw err
        if (!(err instanceof GeminiError)) {
          lastErr = err                           // network error or timeout: retry
          console.warn(`[gemini] ${model} attempt ${attempt + 1} -> ${String(err)}`)
        }
      }
      if (attempt < 2) await sleep(Math.min(8000, 1000 * 2 ** attempt) + Math.random() * 500)
    }
  }
  if (lastErr instanceof GeminiError && RETRYABLE.has(lastErr.status)) {
    throw new HttpError(503, 'busy', 'The AI service is busy right now. Please try again in a minute.')
  }
  if (lastErr instanceof GeminiError) {
    throw new HttpError(502, 'ai_failed', `AI request failed (${lastErr.status}).`)
  }
  throw new HttpError(504, 'timeout', 'The AI took too long to answer. Please try again.')
}

function responseJson(data: any): any {
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
  // Skip thought parts; the answer is the last text part.
  const text = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('')
  try { return JSON.parse(text) } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* ignore */ } }
  console.warn('[gemini] unparseable response', text.slice(0, 300))
  return null
}

async function embedImage(img: InlineImage): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          content: { parts: [inline(img)] },
          embedContentConfig: { outputDimensionality: EMBED_DIMS },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    )
    if (!res.ok) {
      console.warn('[embed] failed', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return null
    }
    const data = await res.json()
    const values: number[] | undefined = data?.embedding?.values ?? data?.embeddings?.[0]?.values
    if (!values || values.length < EMBED_DIMS) return null
    // Matryoshka embeddings can be truncated; re-normalise after truncating.
    const v = values.slice(0, EMBED_DIMS)
    const len = Math.hypot(...v) || 1
    return v.map(x => x / len)
  } catch (err) {
    console.warn('[embed] error', String(err))
    return null
  }
}

// ─── Cached reference data ───────────────────────────────────────────

interface LibrarySpecies { id: string; common_name: string; scientific_name: string | null; category: Category }
interface Tip { species_a: string; species_b: string; tip: string }

let libraryCache: { at: number; rows: LibrarySpecies[] } | null = null
let tipsCache: { at: number; rows: Tip[] } | null = null
const plateCache = new Map<string, { at: number; index: Map<string, string> }>()

async function getLibrary(db: SupabaseClient): Promise<LibrarySpecies[]> {
  if (libraryCache && Date.now() - libraryCache.at < 10 * 60_000) return libraryCache.rows
  const { data, error } = await db.from('species')
    .select('id, common_name, scientific_name, category')
    .order('category').order('common_name')
  if (error) throw error
  libraryCache = { at: Date.now(), rows: (data ?? []) as LibrarySpecies[] }
  return libraryCache.rows
}

async function getTips(db: SupabaseClient): Promise<Tip[]> {
  if (tipsCache && Date.now() - tipsCache.at < 5 * 60_000) return tipsCache.rows
  const { data } = await db.from('species_lookalike_tips').select('species_a, species_b, tip').limit(500)
  tipsCache = { at: Date.now(), rows: (data ?? []) as Tip[] }
  return tipsCache.rows
}

// Field-guide plates are served by the web app. Use the caller's own site
// when it is this app or one of its Netlify deploy previews
// (deploy-preview-N--<site host>), so previews test with their own build;
// otherwise SITE_URL. Never fetch from any other origin.
function plateBaseFor(req: Request): string {
  if (!SITE_URL) return ''
  try {
    const site = new URL(SITE_URL).host
    const origin = new URL(req.headers.get('Origin') ?? '')
    if (origin.protocol === 'https:' && (origin.host === site || origin.host.endsWith(`--${site}`))) return origin.origin
  } catch { /* no or invalid Origin header */ }
  return SITE_URL
}

async function getPlateIndex(base: string): Promise<Map<string, string>> {
  if (!base) return new Map()
  const cached = plateCache.get(base)
  // Keep a good list for an hour; retry an empty one after 5 minutes.
  if (cached && Date.now() - cached.at < (cached.index.size ? 60 : 5) * 60_000) return cached.index
  let files: unknown = []
  try {
    const res = await fetch(`${base}/species-images/manifest.json`, { signal: AbortSignal.timeout(8000) })
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) files = await res.json()
  } catch (err) {
    console.warn('[plates] manifest fetch failed', base, String(err))
  }
  const index = buildPlateIndex(Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [])
  plateCache.set(base, { at: Date.now(), index })
  return index
}

function findInLibrary(library: LibrarySpecies[], common?: string | null, scientific?: string | null): LibrarySpecies | null {
  const c = norm(common)
  const s = norm(scientific)
  return library.find(sp => (s && norm(sp.scientific_name) === s) || (c && norm(sp.common_name) === c)) ?? null
}

// ─── Safety: venomous snakes and their harmless look-alikes ───────────

const DANGER: { match: RegExp; venomous: boolean; note: string }[] = [
  { match: /bungarus|krait/i, venomous: true,
    note: 'Kraits are deadly venomous. The Indian (Common) Krait is often confused with the harmless wolf snakes. Krait: glossy black-blue body, thin white bands in pairs, enlarged hexagonal scales along the spine.' },
  { match: /lycodon|wolf ?snake/i, venomous: false,
    note: 'Wolf snakes mimic the deadly Indian (Common) Krait. Do not handle until a naturalist confirms.' },
  { match: /\bnaja\b|cobra/i, venomous: true,
    note: 'Spectacled Cobra is venomous. It is often confused with the harmless Indian Rat Snake.' },
  { match: /ptyas|rat ?snake/i, venomous: false,
    note: 'Indian Rat Snake is often confused with the venomous cobra and krait. Do not handle until confirmed.' },
  { match: /daboia|russell.?s viper/i, venomous: true,
    note: "Russell's Viper is deadly venomous. It is often confused with the Indian Rock Python and the Common Sand Boa." },
  { match: /python molurus|rock python|eryx|gongylophis|sand boa/i, venomous: false,
    note: "This species is often confused with the deadly Russell's Viper. Do not approach until confirmed." },
  { match: /echis|saw[- ]?scaled/i, venomous: true,
    note: 'Saw-scaled Viper is deadly venomous. It is often confused with the harmless Common Cat Snake.' },
  { match: /boiga|cat ?snake/i, venomous: false,
    note: 'Cat snakes are often confused with the deadly Saw-scaled Viper. Do not handle until confirmed.' },
  { match: /pit ?viper|trimeresurus|craspedocephalus/i, venomous: true,
    note: 'Pit vipers are venomous. Green pit vipers are often confused with the harmless Green Keelback and vine snakes.' },
  { match: /coral ?snake|calliophis/i, venomous: true,
    note: 'Slender Coral Snake is venomous. It is often confused with harmless kukri and black-headed snakes.' },
]

function dangerFor(common?: string | null, scientific?: string | null) {
  const hay = `${common ?? ''} ${scientific ?? ''}`
  return DANGER.find(d => d.match.test(hay)) ?? null
}

// ─── Context ─────────────────────────────────────────────────────────

const SITE_CONTEXT =
  'Tipai estate, beside Tipeshwar Wildlife Sanctuary, Yavatmal district, Maharashtra, central India. ' +
  'Southern tropical dry deciduous forest (teak, bamboo), grassland, scrub, seasonal streams and farmland edges.'

function seasonFor(month: number): string {
  if (month >= 6 && month <= 9) return 'monsoon (June to September)'
  if (month >= 10 && month <= 11) return 'post-monsoon (October to November)'
  if (month === 12 || month <= 2) return 'winter (December to February); winter migrant birds are present'
  return 'hot dry season (March to May)'
}

function buildContext(input: IdentifyInput): string {
  const lines = [`Location: ${SITE_CONTEXT}`]
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    lines.push(`GPS: ${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}.`)
  } else if (input.park === 'tipeshwar') {
    lines.push('Recorded inside Tipeshwar Wildlife Sanctuary (no GPS).')
  }
  const when = input.sighted_at ? new Date(input.sighted_at) : new Date()
  if (!isNaN(when.getTime())) {
    const ist = new Date(when.getTime() + 5.5 * 3600_000)
    const hour = ist.getUTCHours()
    const part = hour < 5 ? 'night' : hour < 8 ? 'early morning' : hour < 17 ? 'daytime' : hour < 20 ? 'dusk' : 'night'
    const month = ist.getUTCMonth() + 1
    lines.push(`Date: ${ist.toISOString().slice(0, 10)}, local time ${String(hour).padStart(2, '0')}:00 (${part}). Season: ${seasonFor(month)}.`)
  }
  if (input.category) lines.push(`The observer classed this as a ${input.category} sighting.`)
  return lines.join('\n')
}

// ─── Identify ────────────────────────────────────────────────────────

interface IdentifyInput {
  images?: InlineImage[]
  category?: Category | null
  latitude?: number | null
  longitude?: number | null
  park?: string | null
  sighted_at?: string | null
  exclude_sighting_id?: string | null
}

interface Candidate {
  common_name: string
  scientific_name: string | null
  category: Category | null
  confidence: number
  field_marks: string
  library: LibrarySpecies | null
}

interface Neighbour {
  sighting_id: string
  species_id: string | null
  common_name: string
  scientific_name: string | null
  category: Category
  storage_path: string
  similarity: number
}

const PASS1_SCHEMA = {
  type: 'OBJECT',
  properties: {
    image_usable: { type: 'BOOLEAN' },
    subject: { type: 'STRING' },
    candidates: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          library_code: { type: 'INTEGER' },
          common_name: { type: 'STRING' },
          scientific_name: { type: 'STRING' },
          category: { type: 'STRING', enum: [...CATEGORIES] },
          confidence: { type: 'NUMBER' },
          field_marks: { type: 'STRING' },
        },
        required: ['library_code', 'common_name', 'scientific_name', 'category', 'confidence', 'field_marks'],
      },
    },
  },
  required: ['image_usable', 'subject', 'candidates'],
}

const PASS2_SCHEMA = {
  type: 'OBJECT',
  properties: {
    image_quality: { type: 'STRING', enum: ['good', 'fair', 'poor'] },
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          candidate_number: { type: 'INTEGER' },
          common_name: { type: 'STRING' },
          scientific_name: { type: 'STRING' },
          category: { type: 'STRING', enum: [...CATEGORIES] },
          confidence: { type: 'NUMBER' },
          visible_field_marks: { type: 'ARRAY', items: { type: 'STRING' } },
          missing_field_marks: { type: 'ARRAY', items: { type: 'STRING' } },
          reasoning: { type: 'STRING' },
        },
        required: ['candidate_number', 'common_name', 'scientific_name', 'category', 'confidence',
          'visible_field_marks', 'missing_field_marks', 'reasoning'],
      },
    },
    lookalike_warning: { type: 'STRING' },
  },
  required: ['image_quality', 'results', 'lookalike_warning'],
}

const SUBJECT_PRIORITY = `SUBJECT PRIORITY: the naturalist is logging a wildlife sighting. The subject is almost always an animal or a sign of one (track, scat, nest, feather, moult). Vegetation is usually background, even when it fills the frame. Look hard for partly hidden, small or low-light animals before choosing a plant. Only choose a plant or fungus when no animal is visible.`

const CONFIDENCE_RULES = `CONFIDENCE RULES: confidence is your honest probability (0.0 to 1.0) that the species is correct. Use 0.9+ only when the diagnostic field marks are clearly visible and no look-alike fits. Use 0.5 to 0.8 when key marks are hidden, blurred or ambiguous. Use below 0.5 for a guess. Most real field photos do NOT deserve 0.9.`

async function identify(db: SupabaseClient, input: IdentifyInput, plateBase: string) {
  const started = Date.now()
  const deadline = started + TIME_BUDGET_MS
  const timings: Record<string, number> = {}

  const images = (input.images ?? []).slice(0, MAX_QUERY_IMAGES)
  if (images.length === 0) throw new HttpError(400, 'bad_request', 'No photo was sent.')
  for (const img of images) {
    if (!img?.data || !/^image\//.test(img.mime_type ?? '')) throw new HttpError(400, 'bad_request', 'Invalid photo.')
    if (img.data.length > MAX_IMAGE_B64) throw new HttpError(413, 'too_large', 'Photo is too large. Please try again.')
  }
  const category = input.category && (CATEGORIES as readonly string[]).includes(input.category) ? input.category : null

  // Library, tips, plates and the photo embedding are independent: run together.
  const [library, tips, plateIndex, embedding] = await Promise.all([
    getLibrary(db), getTips(db), getPlateIndex(plateBase), embedImage(images[0]!),
  ])
  timings.prep = Date.now() - started

  let neighbours: Neighbour[] = []
  if (embedding) {
    const { data, error } = await db.rpc('match_species_examples', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count: 8,
      exclude_sighting: input.exclude_sighting_id ?? null,
    })
    if (error) console.warn('[memory] match failed', error.message)
    neighbours = ((data ?? []) as Neighbour[]).filter(n => !category || n.category === category)
  }

  // ── Pass 1: shortlist from the library ──
  // Library code = 1-based index into the cached library array.
  const libraryText = library
    .map((s, i) => (!category || s.category === category) ? `${i + 1}|${s.common_name}|${s.scientific_name ?? ''}|${s.category}` : null)
    .filter(Boolean)
    .join('\n')
  const neighbourText = neighbours.length
    ? neighbours.slice(0, 6).map(n => `- ${n.common_name}${n.scientific_name ? ` (${n.scientific_name})` : ''}: similarity ${n.similarity.toFixed(2)}`).join('\n')
    : '(none yet)'

  const pass1Prompt = `You are an expert field biologist identifying wildlife at a central Indian forest estate.

${buildContext(input)}

${category ? `All candidates must be ${category}s.` : SUBJECT_PRIORITY}

SPECIES LIBRARY for this estate (code|common name|scientific name|category):
${libraryText}

MOST SIMILAR PHOTOS ALREADY CONFIRMED BY NATURALISTS AT THIS ESTATE (visual similarity, a hint not proof):
${neighbourText}

TASK: Study the photo${images.length > 1 ? 's (all show the same individual)' : ''}. Return the 5 most likely species, best first.
- Prefer species from the library. Set library_code to the library code. Use the library spelling.
- If the species is clearly not in the library, set library_code to 0 and give the standard English and scientific names.
- field_marks: the visible features that support this candidate.
- Consider species that occur in this region and season. Ignore species from other continents.
- Set image_usable to false only if the photo is blank, totally blurred or shows no living thing or sign of one.
${CONFIDENCE_RULES}`

  const pass1 = await generate({
    contents: [{ role: 'user', parts: [{ text: pass1Prompt }, ...images.map(inline)] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PASS1_SCHEMA,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }, deadline)
  timings.pass1 = Date.now() - started
  const p1 = responseJson(pass1.data)

  if (!p1 || p1.image_usable === false || !Array.isArray(p1.candidates) || p1.candidates.length === 0) {
    return {
      engine: ENGINE, model: pass1.model, timings,
      suggestions: [{
        species: 'Unidentified', common_name: 'Unidentified', scientific_name: null, confidence: 0,
        description: p1?.subject ? `Could not identify: ${p1.subject}` : 'The photo could not be used for identification.',
        category: category ?? undefined, engine: ENGINE,
      }],
    }
  }

  const candidates: Candidate[] = []
  for (const c of p1.candidates as any[]) {
    const byCode = Number.isInteger(c.library_code) && c.library_code > 0 ? library[c.library_code - 1] ?? null : null
    const lib = byCode ?? findInLibrary(library, c.common_name, c.scientific_name)
    const cand: Candidate = {
      common_name: lib?.common_name ?? String(c.common_name ?? '').trim(),
      scientific_name: lib ? lib.scientific_name : (c.scientific_name || null),
      category: lib?.category ?? (CATEGORIES.includes(c.category) ? c.category : category),
      confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
      field_marks: String(c.field_marks ?? ''),
      library: lib,
    }
    if (!cand.common_name) continue
    if (candidates.some(x => norm(x.common_name) === norm(cand.common_name))) continue
    candidates.push(cand)
    if (candidates.length === 5) break
  }

  // ── Gather reference images for each candidate ──
  const refs = await Promise.all(candidates.map(async (cand) => {
    const plateFile = findPlate(plateIndex, cand.common_name)
    const sameSpecies = (n: { species_id: string | null; common_name: string }) =>
      (cand.library && n.species_id === cand.library.id) || norm(n.common_name) === norm(cand.common_name)

    let examplePaths = neighbours.filter(sameSpecies).slice(0, 2).map(n => n.storage_path)
    if (examplePaths.length < 2) {
      let q = db.from('species_examples').select('storage_path, sighting_id').limit(3)
      q = cand.library ? q.eq('species_id', cand.library.id) : q.ilike('common_name', cand.common_name)
      const { data } = await q
      for (const row of (data ?? []) as { storage_path: string; sighting_id: string }[]) {
        if (row.sighting_id === input.exclude_sighting_id) continue
        if (!examplePaths.includes(row.storage_path)) examplePaths.push(row.storage_path)
      }
      examplePaths = examplePaths.slice(0, 2)
    }

    const [plate, ...examples] = await Promise.all([
      plateFile ? fetchImage(`${plateBase}/species-images/${encodeURIComponent(plateFile)}`) : Promise.resolve(null),
      ...examplePaths.map(p => fetchImage(publicUrl(p))),
    ])
    return { plate, examples: examples.filter((x): x is InlineImage => !!x) }
  }))
  timings.refs = Date.now() - started

  // ── Pass 2: compare against references ──
  const candidateNames = candidates.flatMap(c => [norm(c.common_name), norm(c.scientific_name)]).filter(Boolean)
  const relevantTips = tips.filter(t => candidateNames.includes(norm(t.species_a)) || candidateNames.includes(norm(t.species_b)))
  const dangerNotes = [...new Set(candidates.map(c => dangerFor(c.common_name, c.scientific_name)?.note).filter(Boolean))]

  const parts: any[] = [{
    text: `You are an expert field biologist. Decide which species is in the field photo by comparing it with reference images of the shortlisted candidates.

${buildContext(input)}

${category ? '' : SUBJECT_PRIORITY}

${relevantTips.length ? `LOOK-ALIKE TIPS FROM THE ESTATE'S NATURALISTS:\n${relevantTips.map(t => `- ${t.species_a} vs ${t.species_b}: ${t.tip}`).join('\n')}\n` : ''}${dangerNotes.length ? `SAFETY NOTES:\n${dangerNotes.map(n => `- ${n}`).join('\n')}\n` : ''}
FIELD PHOTO TO IDENTIFY:`,
  }]
  for (const img of images) parts.push(inline(img))

  candidates.forEach((cand, i) => {
    const r = refs[i]!
    parts.push({
      text: `\nCANDIDATE ${i + 1}: ${cand.common_name}${cand.scientific_name ? ` (${cand.scientific_name})` : ''} [${cand.category ?? 'unknown'}]. First-pass marks: ${cand.field_marks || 'none given'}.${!r.plate && r.examples.length === 0 ? ' No reference images available.' : ''}`,
    })
    if (r.plate) { parts.push({ text: 'Field-guide plate (illustration):' }); parts.push(inline(r.plate)) }
    for (const ex of r.examples) {
      parts.push({ text: 'Photo of this species confirmed by a naturalist at this estate:' })
      parts.push(inline(ex))
    }
  })

  parts.push({
    text: `\nTASK: Compare the field photo with each candidate's references. Check the diagnostic marks one by one. Return up to 3 results, best first.
- candidate_number: the candidate number, or 0 if none of the candidates fit and you are confident it is another species (then give its names).
- visible_field_marks: diagnostic marks you can actually see in the field photo.
- missing_field_marks: diagnostic marks you would need but cannot see (hidden, blurred, wrong angle). Empty if none.
- reasoning: one or two plain sentences a ranger can understand.
- lookalike_warning: if the top answer could be confused with a venomous or dangerous species, say which and how to tell them apart. Otherwise an empty string.
- Illustrated plates show idealised adults; allow for juveniles, females, worn plumage, seasonal and individual variation.
${CONFIDENCE_RULES}`,
  })

  let p2: any = null
  let model = pass1.model
  try {
    const pass2 = await generate({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PASS2_SCHEMA,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingLevel: 'medium' },
      },
    }, deadline, pass1.model)
    model = pass2.model
    p2 = responseJson(pass2.data)
  } catch (err) {
    // Pass 2 is a refinement: if it fails, return the pass 1 shortlist.
    console.warn('[identify] pass 2 failed, using pass 1', String(err))
  }
  timings.pass2 = Date.now() - started

  const suggestions = p2 && Array.isArray(p2.results) && p2.results.length > 0
    ? finalFromPass2(p2, candidates, library, category)
    : candidates.slice(0, 3).map(c => toSuggestion(c, c.confidence, [c.field_marks].filter(Boolean), [], c.field_marks))

  // Safety warning: model's own warning, else our static note for the top
  // answer, else for any venomous species or mimic in the shortlist.
  const top = suggestions[0]
  const staticWarning = (top && dangerFor(top.common_name, top.scientific_name)?.note) ?? dangerNotes[0] ?? null
  const warning = (p2?.lookalike_warning && String(p2.lookalike_warning).trim()) || staticWarning
  if (top && warning) top.warning = warning

  timings.total = Date.now() - started
  console.log('[identify] done', JSON.stringify({ model, timings, plates: plateIndex.size, neighbours: neighbours.length, candidates: candidates.length }))
  return { engine: ENGINE, model, timings, suggestions }
}

function finalFromPass2(p2: any, candidates: Candidate[], library: LibrarySpecies[], category: Category | null) {
  const quality: string = p2.image_quality
  const cap = quality === 'poor' ? 0.5 : quality === 'fair' ? 0.8 : 0.97
  const out: ReturnType<typeof toSuggestion>[] = []
  for (const r of (p2.results as any[]).slice(0, 3)) {
    const fromList = Number.isInteger(r.candidate_number) && r.candidate_number > 0 ? candidates[r.candidate_number - 1] : undefined
    const lib = fromList?.library ?? findInLibrary(library, r.common_name, r.scientific_name)
    const cand: Candidate = fromList ?? {
      common_name: lib?.common_name ?? String(r.common_name ?? '').trim(),
      scientific_name: lib ? lib.scientific_name : (r.scientific_name || null),
      category: lib?.category ?? (CATEGORIES.includes(r.category) ? r.category : category),
      confidence: 0,
      field_marks: '',
      library: lib,
    }
    if (!cand.common_name || out.some(o => norm(o.common_name) === norm(cand.common_name))) continue
    const missing: string[] = Array.isArray(r.missing_field_marks) ? r.missing_field_marks.filter(Boolean) : []
    let conf = Math.max(0, Math.min(1, Number(r.confidence) || 0))
    conf = Math.min(conf, cap, missing.length ? 0.75 : 1)
    const visible: string[] = Array.isArray(r.visible_field_marks) ? r.visible_field_marks.filter(Boolean) : []
    out.push(toSuggestion(cand, conf, visible, missing, String(r.reasoning ?? '')))
  }
  // Keep the list ranked after capping.
  return out.sort((a, b) => b.confidence - a.confidence)
}

function toSuggestion(c: Candidate, confidence: number, visible: string[], missing: string[], description: string) {
  const danger = dangerFor(c.common_name, c.scientific_name)
  return {
    species: c.common_name,
    common_name: c.common_name,
    scientific_name: c.scientific_name,
    confidence: Math.round(confidence * 100) / 100,
    description,
    category: c.category ?? undefined,
    species_id: c.library?.id ?? null,
    in_library: !!c.library,
    field_marks: visible.slice(0, 6),
    missing_marks: missing.slice(0, 4),
    venomous: danger?.venomous ?? false,
    warning: null as string | null,
    engine: ENGINE,
  }
}

// ─── Learn ───────────────────────────────────────────────────────────

async function learn(db: SupabaseClient, userId: string, body: { sighting_id?: string; image?: InlineImage }) {
  const { data: profile } = await db.from('profiles').select('role').eq('id', userId).single()
  if (!profile || !['naturalist', 'admin'].includes(profile.role)) {
    throw new HttpError(403, 'forbidden', 'Only naturalists and admins can teach the AI.')
  }
  if (!body.sighting_id) throw new HttpError(400, 'bad_request', 'sighting_id is required.')

  const { data: sighting, error } = await db.from('sightings')
    .select('id, species_id, common_name, scientific_name, category, verification_status')
    .eq('id', body.sighting_id).single()
  if (error || !sighting) throw new HttpError(404, 'not_found', 'Sighting not found.')

  // Unnamed or rejected records must not teach the AI anything.
  if (!sighting.common_name?.trim() || sighting.verification_status === 'rejected') {
    await db.from('species_examples').delete().eq('sighting_id', sighting.id)
    return { learned: false, removed: true }
  }

  const img = body.image
  if (!img?.data || !/^image\//.test(img.mime_type ?? '')) throw new HttpError(400, 'bad_request', 'A thumbnail is required.')
  if (img.data.length > MAX_LEARN_B64) throw new HttpError(413, 'too_large', 'Thumbnail is too large.')

  const embedding = await embedImage(img)
  if (!embedding) throw new HttpError(502, 'embed_failed', 'Could not read the photo. Please try again.')

  const path = `ai-examples/${sighting.id}.jpg`
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, decodeBase64(img.data), {
    contentType: img.mime_type, upsert: true,
  })
  if (upErr) throw upErr

  let speciesId: string | null = sighting.species_id
  if (!speciesId) {
    const lib = findInLibrary(await getLibrary(db), sighting.common_name, sighting.scientific_name)
    speciesId = lib?.id ?? null
  }

  const { error: insErr } = await db.from('species_examples').upsert({
    sighting_id: sighting.id,
    species_id: speciesId,
    common_name: sighting.common_name.trim(),
    scientific_name: sighting.scientific_name,
    category: sighting.category,
    storage_path: path,
    embedding: `[${embedding.join(',')}]`,
    confirmed_by: userId,
  }, { onConflict: 'sighting_id' })
  if (insErr) throw insErr

  return { learned: true }
}

// ─── Entry point ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed', code: 'bad_request' }, 405)
  if (!GEMINI_API_KEY) return json({ error: 'AI is not set up on the server (GEMINI_API_KEY missing).', code: 'not_configured' }, 500)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Please sign in to use AI identification.', code: 'unauthorised' }, 401)

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON', code: 'bad_request' }, 400) }

  try {
    if (body?.action === 'identify') return json(await identify(db, body, plateBaseFor(req)))
    if (body?.action === 'learn') return json(await learn(db, user.id, body))
    return json({ error: 'Unknown action', code: 'bad_request' }, 400)
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status)
    console.error('[identify-species] unexpected', err)
    return json({ error: 'Something went wrong. Please try again.', code: 'failed' }, 500)
  }
})
