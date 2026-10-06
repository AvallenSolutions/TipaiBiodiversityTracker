import { DS } from '@/lib/ledger-design'
import { getBundledSpeciesImage } from '@/lib/speciesImages'
import { Mono } from '@/components/logger/shared'

// Field-guide plates next to AI answers, so the observer can check the
// AI's pick with their own eyes before accepting it.

export interface PlateTarget {
  name: string
  scientific?: string | null
  plateUrl: string
}

/** Field-guide plate for a species name, or null if none is bundled. */
export function plateTargetFor(name: string | null | undefined, scientific?: string | null): PlateTarget | null {
  const plateUrl = getBundledSpeciesImage(name)
  return name && plateUrl ? { name, scientific, plateUrl } : null
}

/** Small plate thumbnail button. Place it beside (not inside) a row's own button. */
export function PlateThumb({ target, size = 56, onOpen }: {
  target: PlateTarget
  size?: number
  onOpen: (t: PlateTarget) => void
}) {
  return (
    <button
      type="button"
      aria-label={`Compare with the field guide plate of ${target.name}`}
      onClick={(e) => { e.stopPropagation(); onOpen(target) }}
      style={{
        position: 'relative', flexShrink: 0, width: size, height: size, padding: 0,
        border: `0.5px solid ${DS.inkFaint}`, background: DS.bone, cursor: 'zoom-in',
        display: 'block', overflow: 'hidden',
      }}
    >
      <img src={target.plateUrl} alt="" loading="lazy"
           style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      <span style={{
        position: 'absolute', right: 0, bottom: 0, padding: '1px 4px',
        background: 'rgba(28,37,32,0.75)', color: DS.ivory,
        fontFamily: DS.mono, fontSize: 7, letterSpacing: '0.15em',
      }}>GUIDE</span>
    </button>
  )
}

/** Full-screen side-by-side: the observer's photo above, the plate below. */
export function PlateCompare({ photoUrl, target, onClose }: {
  photoUrl: string | null
  target: PlateTarget
  onClose: () => void
}) {
  const pane: React.CSSProperties = {
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6,
  }
  const img: React.CSSProperties = {
    flex: 1, minHeight: 0, width: '100%', objectFit: 'contain', background: '#000',
  }
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label={`Compare your photo with ${target.name}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(11,14,12,0.95)',
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ Compare with the field guide</Mono>
        <button onClick={onClose} style={{
          background: 'transparent', border: `0.5px solid ${DS.ivory}`, color: DS.ivory,
          padding: '6px 12px', cursor: 'pointer',
          fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>Close</button>
      </div>
      {photoUrl && (
        <div style={pane}>
          <Mono size={8} letter={0.2} color={DS.ivory}>Your photo</Mono>
          <img src={photoUrl} alt="Your sighting" style={img} />
        </div>
      )}
      <div style={pane}>
        <Mono size={8} letter={0.2} color={DS.ivory}>
          Field guide · {target.name}{target.scientific ? ` (${target.scientific})` : ''}
        </Mono>
        <img src={target.plateUrl} alt={`Field guide plate: ${target.name}`} style={{ ...img, background: DS.ivory }} />
      </div>
    </div>
  )
}
