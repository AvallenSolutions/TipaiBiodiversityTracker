import type { Sighting } from '@/types'

export function exportToCSV(sightings: Sighting[]): void {
  const headers = [
    'id', 'category', 'common_name', 'scientific_name', 'latitude', 'longitude',
    'sighted_at', 'verification_status', 'ai_confidence', 'individual_count',
    'notes', 'created_at',
  ]
  const rows = sightings.map(s =>
    headers.map(h => {
      const val = s[h as keyof Sighting]
      return `"${String(val ?? '').replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  download(csv, 'tipai-sightings.csv', 'text/csv')
}

export function exportToJSON(sightings: Sighting[]): void {
  const json = JSON.stringify(sightings, null, 2)
  download(json, 'tipai-sightings.json', 'application/json')
}

export function exportToGeoJSON(sightings: Sighting[]): void {
  const geojson = {
    type: 'FeatureCollection' as const,
    features: sightings.map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
      properties: {
        id: s.id,
        category: s.category,
        common_name: s.common_name,
        scientific_name: s.scientific_name,
        sighted_at: s.sighted_at,
        verification_status: s.verification_status,
        ai_confidence: s.ai_confidence,
        notes: s.notes,
      },
    })),
  }
  download(JSON.stringify(geojson, null, 2), 'tipai-sightings.geojson', 'application/geo+json')
}

function download(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
