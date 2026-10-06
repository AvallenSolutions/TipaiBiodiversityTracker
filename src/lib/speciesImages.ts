// Map a species common name to a curated reference photo bundled in
// /public/species-images. The matching rules live in
// supabase/functions/_shared/speciesPlates.ts so the identify-species edge
// function resolves plates exactly the same way.

import { buildPlateIndex, findPlate } from '../../supabase/functions/_shared/speciesPlates'

const FILES: string[] = typeof __SPECIES_IMAGES__ !== 'undefined' ? __SPECIES_IMAGES__ : []

const INDEX = buildPlateIndex(FILES)

/**
 * Returns the URL of a bundled reference photo for the given species name,
 * or null if no plate is bundled. Result is a static path served from the
 * /public folder, so it works offline once the SW has cached the asset.
 */
export function getBundledSpeciesImage(commonName: string | null | undefined): string | null {
  const file = findPlate(INDEX, commonName)
  return file ? `/species-images/${file}` : null
}
