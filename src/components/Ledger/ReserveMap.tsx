import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { format } from 'date-fns'
import { DS } from '../../lib/ledger-design'
import { Mono } from './shared'
import type { Sighting, SightingCategory } from '../../types'

// Editorial palette for the dots — keeps the map consistent with the
// rest of the dashboard (CatDot uses these tones too).
const CAT_COLORS: Record<SightingCategory, string> = {
  mammal: DS.ochre,
  bird: '#4A7FA5',
  reptile: DS.forest,
  amphibian: '#5E8A8A',
  insect: DS.rust,
  plant: DS.forest,
  fungi: '#7B5E8A',
  trace: DS.inkSoft,
}

function makeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'reserve-map-pin',
    html: `<span style="
      display:block;width:14px;height:14px;border-radius:7px;
      background:${color};
      border:1.5px solid ${DS.ivory};
      box-shadow:0 1px 3px rgba(11,14,12,0.45);
    "></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

interface LocatedSighting extends Sighting {
  latitude: number
  longitude: number
}

export function ReserveMap({
  sightings,
  onOpenSighting,
}: {
  sightings: Sighting[]
  onOpenSighting?: (s: Sighting) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onOpenRef = useRef(onOpenSighting)
  useEffect(() => { onOpenRef.current = onOpenSighting }, [onOpenSighting])

  // Sightings without a GPS fix can't be placed — they're surfaced in the
  // Review Queue instead so a naturalist can backfill coordinates.
  const located = useMemo(
    () => sightings.filter(
      (s): s is LocatedSighting => s.latitude != null && s.longitude != null
    ),
    [sightings],
  )

  // Mount the map exactly once, then drive it from effects below.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      // Sensible default centred over Tipai (north-east of Tadoba) so the
      // canvas isn't blank before sightings load. Adjusted by fitBounds
      // below as soon as data arrives.
      center: [21.65, 79.5],
      zoom: 9,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // Re-render markers whenever the located set changes.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    if (located.length === 0) return

    for (const s of located) {
      const color = CAT_COLORS[s.category] ?? DS.ochre
      const marker = L.marker([s.latitude, s.longitude], { icon: makeIcon(color) })
      const safeName = (s.common_name || s.scientific_name || s.category)
        .replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!))
      const when = format(new Date(s.sighted_at), 'd MMM · HH:mm')
      const html = `
        <div style="font-family:${DS.serif}; min-width:160px;">
          <div style="font-family:${DS.mono}; font-size:9px; letter-spacing:0.18em;
                      text-transform:uppercase; color:${DS.inkSoft};">
            ${s.category.toUpperCase()} · ${when}
          </div>
          <div style="font-size:15px; font-weight:400; color:${DS.ink}; margin-top:2px;">
            ${safeName}
          </div>
          <div style="margin-top:8px;">
            <button data-sighting-open style="
              background:transparent; border:none; padding:0; cursor:pointer;
              font-family:${DS.mono}; font-size:9px; letter-spacing:0.22em;
              text-transform:uppercase; color:${DS.ochre};
            ">Open record →</button>
          </div>
        </div>
      `
      marker.bindPopup(html, { closeButton: true, autoPan: true })
      marker.on('popupopen', (e) => {
        const node = (e.popup.getElement() as HTMLElement | null)
          ?.querySelector<HTMLButtonElement>('[data-sighting-open]')
        if (node && onOpenRef.current) {
          node.onclick = () => { onOpenRef.current?.(s) }
        }
      })
      marker.addTo(layer)
    }

    // Frame the markers. Single point: pick a comfortable street-level zoom;
    // multiple points: fit with a little padding.
    if (located.length === 1) {
      map.setView([located[0]!.latitude, located[0]!.longitude], 13, { animate: false })
    } else {
      const bounds = L.latLngBounds(located.map(s => [s.latitude, s.longitude] as [number, number]))
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false })
    }
  }, [located])

  // Tile layers can render with the wrong size if the container is sized
  // by a parent flex/grid that resolves after mount. Force a recompute
  // once the layout settles.
  useEffect(() => {
    if (!mapRef.current) return
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [])

  // Categories present, for the legend
  const legend = useMemo(() => {
    const set = new Set<SightingCategory>()
    for (const s of located) set.add(s.category)
    return Array.from(set)
  }, [located])

  return (
    <div>
      <Mono size={9} color={DS.ochre}>◆ §03 · RESERVE MAP</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
        letterSpacing: '-0.02em', marginTop: 4, marginBottom: 14,
      }}>
        Spatial distribution
      </div>

      <div style={{ background: DS.ivory, border: `0.5px solid ${DS.ink}`, position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ height: 360, width: '100%', background: DS.bone }}
          aria-label="Map of recorded sightings"
        />

        {located.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              padding: '14px 18px', background: 'rgba(244,238,226,0.92)',
              border: `0.5px solid ${DS.inkFaint}`, textAlign: 'center', maxWidth: 320,
            }}>
              <Mono size={9} color={DS.ochre} letter={0.2} style={{ display: 'block', marginBottom: 4 }}>
                No located sightings
              </Mono>
              <span style={{
                fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
                fontWeight: 300, color: DS.inkSoft, lineHeight: 1.4,
              }}>
                Sightings need a GPS fix to be plotted. Add coordinates from the Review Queue.
              </span>
            </div>
          </div>
        )}

        {/* Legend & count */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, padding: '10px 14px',
          borderTop: `0.5px solid ${DS.inkHair}`, background: DS.ivory,
          flexWrap: 'wrap',
        }}>
          <Mono size={9} color={DS.inkSoft} letter={0.18}>
            {located.length} located · {sightings.length - located.length} without GPS
          </Mono>
          {legend.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {legend.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: CAT_COLORS[cat], display: 'inline-block',
                    border: `1px solid ${DS.ivory}`,
                  }} />
                  <Mono size={8} letter={0.18} color={DS.inkSoft}>{cat.toUpperCase()}</Mono>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
