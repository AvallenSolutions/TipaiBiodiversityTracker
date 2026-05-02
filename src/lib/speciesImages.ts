// Map a species common name to a curated reference photo bundled in
// /public/species-images. Filenames are uppercase common names with
// underscores separating words and a few well-defined variations:
//
//   ASIATIC_ELEPHANT.jpg               // plain
//   BENGAL_TIGER_01.jpg                // numbered variant — multiple plates
//   ASIATIC_WILDCAT_or_DESERT_CAT_Felis_sylvestris.jpg   // alternate names + scientific
//   BLYTHS_PIPIT_Anthus_godlewskii.jpg                   // scientific name suffix
//   BAR-HEADED_GOOSE.jpg               // hyphens in name preserved
//
// We build a normalized lookup map at module load: each filename produces
// several candidate keys (full name; without _NN suffix; without scientific
// suffix; each side of an _or_ alias). At call time we normalize the input
// the same way and look up against the map.

const FILES: string[] = typeof __SPECIES_IMAGES__ !== 'undefined' ? __SPECIES_IMAGES__ : []

function deriveKeys(filenameSansExt: string): string[] {
  const out = new Set<string>()
  out.add(filenameSansExt)

  // Strip trailing _NN (numbered variants like _01, _02)
  const noNumber = filenameSansExt.replace(/_\d{2,}$/, '')
  out.add(noNumber)

  // Strip trailing scientific name suffix. Pattern: a Title-cased word
  // followed by 1-2 lowercase words (e.g. _Anthus_godlewskii or
  // _Rucervus_duvaucelii_branderi). Underscored, no hyphens in the
  // scientific portion in the corpus.
  const noScientific = noNumber.replace(/_[A-Z][a-z]+(?:_[a-z]+){1,2}$/, '')
  out.add(noScientific)

  // _or_ alternates: register both halves so either common name resolves
  // to the same plate.
  if (noScientific.includes('_or_')) {
    for (const part of noScientific.split('_or_')) {
      if (part) out.add(part)
    }
  }

  return Array.from(out)
}

const INDEX = (() => {
  const map = new Map<string, string>()
  for (const file of FILES) {
    const base = file.replace(/\.jpe?g$/i, '')
    for (const key of deriveKeys(base)) {
      const upper = key.toUpperCase()
      // First-write-wins so an exact-name plate beats a partial-key match
      // when both exist (e.g. ASIATIC_ELEPHANT vs an _or_ alternate).
      if (!map.has(upper)) map.set(upper, file)
    }
  }
  return map
})()

function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip combining accents
    .replace(/[‘’']/g, '')       // strip apostrophes (curly + straight)
    .replace(/[^A-Za-z0-9 \-]/g, ' ')      // other punctuation -> space
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
}

/**
 * Returns the URL of a bundled reference photo for the given species name,
 * or null if no plate is bundled. Result is a static path served from the
 * /public folder, so it works offline once the SW has cached the asset.
 */
export function getBundledSpeciesImage(commonName: string | null | undefined): string | null {
  if (!commonName) return null
  const key = normalizeName(commonName)
  if (!key) return null
  const file = INDEX.get(key)
  return file ? `/species-images/${file}` : null
}
