import type { CSSProperties, ReactNode } from 'react'
import { DS } from '../../lib/ledger-design'
import type { SightingCategory } from '../../types'

export function Mono({
  children, size = 10, color, letter = 0.2, style,
}: {
  children?: ReactNode
  size?: number
  color?: string
  letter?: number
  style?: CSSProperties
}) {
  return (
    <span style={{
      fontFamily: DS.mono, fontSize: size, color: color ?? DS.ink,
      letterSpacing: `${letter}em`, textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </span>
  )
}

export function Rule({ double, color }: { double?: boolean; color?: string }) {
  return (
    <div style={{
      borderTop: double ? `3px double ${color ?? DS.ink}` : `0.5px solid ${color ?? DS.inkHair}`,
    }} />
  )
}

/**
 * The "blank" — an inline tappable span that renders as a filled underline
 * when a value is set and a dashed italic placeholder when empty.
 */
export function Blank({
  children, onClick, placeholder,
}: {
  children?: ReactNode
  onClick?: () => void
  placeholder: string
}) {
  const filled = children != null && children !== ''
  return (
    <span
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      style={{
        cursor: 'pointer',
        color: filled ? DS.ink : DS.inkSoft,
        borderBottom: `1px ${filled ? 'solid' : 'dashed'} ${filled ? DS.ink : DS.inkFaint}`,
        paddingBottom: 1,
        whiteSpace: 'nowrap',
        fontStyle: filled ? 'inherit' : 'italic',
        fontWeight: filled ? 400 : 300,
      }}
    >
      {filled ? children : placeholder}
    </span>
  )
}

/**
 * Circular confidence dial — SVG stroke-dasharray, colour-graded.
 */
export function ConfidenceDial({
  value, size = 44, stroke = 2,
}: { value: number; size?: number; stroke?: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = pct >= 70 ? DS.forest : pct >= 40 ? DS.ochre : DS.rust
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DS.inkHair} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${c * (pct / 100)} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: DS.mono, fontSize: size <= 30 ? 9 : 11,
        letterSpacing: '0.05em', color,
      }}>{pct}</div>
    </div>
  )
}

/**
 * Monoline field-guide category icons — drawn in-line so they inherit
 * the currentColor and stroke-width rules of the surrounding context.
 */
const iconProps = {
  fill: 'none' as const, stroke: 'currentColor',
  strokeWidth: 1.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

export function MonoIcon({
  category, size = 22,
}: { category: SightingCategory; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...iconProps }
  switch (category) {
    case 'mammal':
      return (
        <svg {...common}>
          <path d="M5 14c0-3 2-5 5-5h4c3 0 5 2 5 5v2c0 2-1 3-3 3H8c-2 0-3-1-3-3z" />
          <path d="M7 9l-1-3 2 1M17 9l1-3-2 1" />
          <circle cx="10" cy="13" r="0.5" fill="currentColor" />
          <circle cx="14" cy="13" r="0.5" fill="currentColor" />
        </svg>
      )
    case 'bird':
      return (
        <svg {...common}>
          <path d="M6 12c0-3 2-6 6-6 4 0 6 2 7 5l-2 1-2-1-3 2v4l-3 1v-3l-3-2z" />
          <circle cx="14" cy="9" r="0.5" fill="currentColor" />
        </svg>
      )
    case 'reptile':
      return (
        <svg {...common}>
          <path d="M3 15c2 0 3-1 4-2s2-3 5-3 4 1 5 2 2 2 4 2v2h-2l-1-1-2 1h-3l-2-1-2 1H6l-1-1H3z" />
        </svg>
      )
    case 'amphibian':
      return (
        <svg {...common}>
          <path d="M4 16c0-3 3-6 8-6s8 3 8 6v2H4z" />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
        </svg>
      )
    case 'insect':
      return (
        <svg {...common}>
          <path d="M12 5v14M7 9l5-2 5 2M6 14h12M8 19l4-3 4 3" />
        </svg>
      )
    case 'plant':
      return (
        <svg {...common}>
          <path d="M12 20V8M12 8c0-3 2-5 5-5-1 4-2 6-5 7M12 8c0-3-2-5-5-5 1 4 2 6 5 7" />
        </svg>
      )
    case 'fungi':
      return (
        <svg {...common}>
          <path d="M4 11c0-4 4-7 8-7s8 3 8 7H4z" />
          <path d="M10 11v9M14 11v9" />
        </svg>
      )
    case 'trace':
      return (
        <svg {...common}>
          <ellipse cx="9" cy="15" rx="2" ry="3" />
          <ellipse cx="15" cy="9" rx="2" ry="3" />
          <circle cx="6" cy="9" r="1" />
          <circle cx="18" cy="15" r="1" />
        </svg>
      )
    default:
      return null
  }
}

/**
 * PickerSheet — bottom sheet for blank-filling.
 */
export function PickerSheet({
  title, options, value, onChoose, onClose, numeric,
}: {
  title: string
  options?: string[]
  value: string | number | null
  onChoose: (v: string | number) => void
  onClose: () => void
  numeric?: boolean
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(11,14,12,0.4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: DS.ivory, padding: '18px 20px 40px' }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 12, borderBottom: `1px solid ${DS.ink}`,
        }}>
          <Mono size={10} letter={0.2}>{title}</Mono>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Close</button>
        </div>

        {numeric ? (
          <div style={{ padding: '22px 0 10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 20,
            }}>
              <button
                onClick={() => onChoose(Math.max(1, (Number(value) || 1) - 1))}
                style={numBtn}
              >−</button>
              <div style={{
                fontFamily: DS.serif, fontSize: 64, fontWeight: 200,
                minWidth: 120, textAlign: 'center', color: DS.ink, lineHeight: 1,
              }}>{Number(value) || 1}</div>
              <button
                onClick={() => onChoose((Number(value) || 1) + 1)}
                style={numBtn}
              >+</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
              {[1, 2, 3, 5, 10].map(n => (
                <button key={n} onClick={() => onChoose(n)} style={{
                  padding: '6px 12px', border: `0.5px solid ${DS.inkFaint}`,
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: DS.mono, fontSize: 11,
                  letterSpacing: '0.1em', color: DS.ink,
                }}>{n}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 8, paddingTop: 18,
          }}>
            {options?.map(opt => (
              <button key={opt} onClick={() => onChoose(opt)} style={{
                padding: '14px 14px', textAlign: 'left',
                background: value === opt ? DS.ink : 'transparent',
                color: value === opt ? DS.ivory : DS.ink,
                border: `0.5px solid ${value === opt ? DS.ink : DS.inkFaint}`,
                cursor: 'pointer',
                fontFamily: DS.serif, fontSize: 15, fontWeight: 400,
              }}>{opt}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const numBtn: CSSProperties = {
  width: 44, height: 44, borderRadius: 22, border: `0.5px solid ${DS.ink}`,
  background: 'transparent', cursor: 'pointer',
  fontFamily: DS.serif, fontSize: 22, fontWeight: 300, color: DS.ink,
}

/**
 * Category colour for the small dot used on list rows.
 */
export const CAT_COLOR: Record<SightingCategory, string> = {
  mammal: '#B8935A', bird: '#4A7FA5', reptile: '#6B8F5E',
  amphibian: '#5E8A8A', insect: '#A0503C', plant: '#3F5048',
  fungi: '#7B5E8A', trace: '#8A7B5E',
}

export const CAT_LETTER: Record<SightingCategory, string> = {
  mammal: 'M', bird: 'B', reptile: 'R', amphibian: 'A',
  insect: 'I', plant: 'P', fungi: 'F', trace: 'T',
}
