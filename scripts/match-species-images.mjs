#!/usr/bin/env node
// Match uploaded species image filenames in public/species-images/ to species
// rows in Supabase, then preview or apply UPDATEs to species.reference_image_url.
//
// Usage:
//   node scripts/match-species-images.mjs            # dry-run, prints report
//   node scripts/match-species-images.mjs --apply    # write updates to DB
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL) from .env.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// --- env loader (no dotenv dep) ----------------------------------------------
const envText = readFileSync(join(ROOT, '.env'), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// Manual filename → species common_name overrides for cases the heuristic
// misses (e.g. spelling typos in the uploaded filenames).
const FILENAME_OVERRIDES = {
  'GOLDEN_DARLTET_schnura_aurora.jpg': 'Golden Dartlet', // typo: DARLTET → DARTLET, schnura → Ischnura
}

// --- normalize a string for matching: strip non-alphanumerics, lowercase ----
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

// --- parse filename → candidate common-name strings -------------------------
// A filename like ASIATIC_WILDCAT_or_DESERT_CAT_Felis_sylvestris.jpg should
// produce candidates: "Asiatic Wildcat or Desert Cat", "Asiatic Wildcat",
// "Desert Cat" (and the same after stripping the Latin tail).
function candidatesFromFilename(filename) {
  let stem = filename.replace(/\.(jpe?g|png|webp|gif)$/i, '')

  // Strip trailing _01 / _02 multi-image suffix (and capture order).
  let order = 1
  const m = stem.match(/_(\d{2})$/)
  if (m) {
    order = parseInt(m[1], 10)
    stem = stem.slice(0, -m[0].length)
  }

  // Strip trailing scientific-name suffix:
  //   _Genus_species               (e.g. _Felis_sylvestris)
  //   _Genus_species_subspecies   (e.g. _Rucervus_duvaucelii_branderi)
  // Pattern: capitalized first token, then 1-3 lowercase tokens.
  const sciMatch = stem.match(/_([A-Z][a-z]+(?:_[a-z]+){1,3})$/)
  let scientific = null
  if (sciMatch) {
    scientific = sciMatch[1].replace(/_/g, ' ')
    stem = stem.slice(0, -sciMatch[0].length)
  }

  // Now stem is the common-name part, e.g. ASIATIC_WILDCAT_or_DESERT_CAT.
  const variants = new Set()
  const whole = stem.replace(/_/g, ' ')
  variants.add(whole)
  // Split on " or " (originally "_or_") into each side.
  if (/\s+or\s+/i.test(whole)) {
    for (const part of whole.split(/\s+or\s+/i)) variants.add(part)
  }
  return { variants: [...variants], order, scientific }
}

// --- load filenames ----------------------------------------------------------
// Prefer a manifest file (one filename per line) if present; otherwise read
// public/species-images/. The manifest is useful when the binaries live on
// another branch but we still want to do the matching work.
const IMG_DIR = join(ROOT, 'public', 'species-images')
let filenames
const manifestArg = process.argv.find((a) => a.startsWith('--manifest='))
if (manifestArg) {
  const path = manifestArg.slice('--manifest='.length)
  filenames = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && /\.(jpe?g|png|webp|gif)$/i.test(l))
    .sort()
  console.log(`Loaded ${filenames.length} image filenames from manifest ${path}`)
} else {
  filenames = readdirSync(IMG_DIR)
    .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .sort()
  console.log(`Loaded ${filenames.length} image files from public/species-images/`)
}

// --- fetch species -----------------------------------------------------------
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/species?select=id,common_name,scientific_name,category,reference_image_url&order=common_name&limit=2000`,
  { headers }
)
if (!res.ok) {
  console.error('Failed to fetch species:', res.status, await res.text())
  process.exit(1)
}
const species = await res.json()
console.log(`Fetched ${species.length} species rows from Supabase`)

// Build lookup tables: by normalized common_name and by normalized scientific.
const byCommon = new Map()
const bySci = new Map()
for (const sp of species) {
  byCommon.set(norm(sp.common_name), sp)
  if (sp.scientific_name) bySci.set(norm(sp.scientific_name), sp)
}

// --- match -------------------------------------------------------------------
// For each species id, collect ordered list of files that map to it.
const matchedBySpeciesId = new Map() // id -> [{file, order, via}]
const unmatchedFiles = []

for (const file of filenames) {
  const { variants, order, scientific } = candidatesFromFilename(file)
  let hit = null
  let via = null
  if (FILENAME_OVERRIDES[file]) {
    const sp = byCommon.get(norm(FILENAME_OVERRIDES[file]))
    if (sp) { hit = sp; via = `override:${FILENAME_OVERRIDES[file]}` }
  }
  if (!hit) {
    for (const v of variants) {
      const sp = byCommon.get(norm(v))
      if (sp) { hit = sp; via = `common:${v}`; break }
    }
  }
  if (!hit && scientific) {
    const sp = bySci.get(norm(scientific))
    if (sp) { hit = sp; via = `scientific:${scientific}` }
  }
  if (hit) {
    if (!matchedBySpeciesId.has(hit.id)) matchedBySpeciesId.set(hit.id, [])
    matchedBySpeciesId.get(hit.id).push({ file, order, via })
  } else {
    unmatchedFiles.push({ file, variants, scientific })
  }
}

// Sort each species's files by order so _01 wins as the canonical image.
for (const list of matchedBySpeciesId.values()) {
  list.sort((a, b) => a.order - b.order)
}

const speciesWithoutImage = species.filter(
  (sp) => !matchedBySpeciesId.has(sp.id)
)

// --- report ------------------------------------------------------------------
console.log('')
console.log('================ MATCH SUMMARY ================')
console.log(`Image files            : ${filenames.length}`)
console.log(`Files matched          : ${filenames.length - unmatchedFiles.length}`)
console.log(`Files unmatched        : ${unmatchedFiles.length}`)
console.log(`Species rows           : ${species.length}`)
console.log(`Species with ≥1 image  : ${matchedBySpeciesId.size}`)
console.log(`Species with no image  : ${speciesWithoutImage.length}`)
console.log('')

if (unmatchedFiles.length) {
  console.log(`---- Unmatched files (${unmatchedFiles.length}) ----`)
  for (const u of unmatchedFiles) console.log(`  ${u.file}   tried: ${u.variants.join(' | ')}${u.scientific ? `  [sci: ${u.scientific}]` : ''}`)
  console.log('')
}

if (speciesWithoutImage.length) {
  console.log(`---- Species with no image (${speciesWithoutImage.length}) ----`)
  for (const sp of speciesWithoutImage) console.log(`  [${sp.category}] ${sp.common_name}${sp.scientific_name ? ` (${sp.scientific_name})` : ''}`)
  console.log('')
}

const multiImage = [...matchedBySpeciesId.entries()].filter(([_, list]) => list.length > 1)
if (multiImage.length) {
  console.log(`---- Species with multiple images (${multiImage.length}) ----`)
  for (const [id, list] of multiImage) {
    const sp = species.find((s) => s.id === id)
    console.log(`  ${sp.common_name}: ${list.map((x) => x.file).join(', ')}`)
  }
  console.log('')
}

// --- apply -------------------------------------------------------------------
const APPLY = process.argv.includes('--apply')
if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to write reference_image_url updates to Supabase.')
  process.exit(0)
}

console.log('Applying updates...')
let ok = 0
let fail = 0
for (const [id, list] of matchedBySpeciesId) {
  const cover = `/species-images/${list[0].file}` // _01 / lowest-order canonical
  const gallery = list.slice(1).map((x) => `/species-images/${x.file}`)
  const body = { reference_image_url: cover, gallery_image_urls: gallery }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/species?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (r.ok) ok++
  else {
    fail++
    console.error(`FAIL ${id}: ${r.status} ${await r.text()}`)
  }
}
console.log(`Updates applied. ok=${ok} fail=${fail}`)
