import { CSSProperties, ReactNode } from 'react'
import { DS, catLetter } from '../../lib/ledger-design'

export function Mono({
  children, size = 10, letter = 0.2, color, style = {}, upper = true,
}: {
  children: ReactNode
  size?: number
  letter?: number
  color?: string
  style?: CSSProperties
  upper?: boolean
}) {
  return (
    <span style={{
      fontFamily: DS.mono, fontSize: size, letterSpacing: `${letter}em`,
      textTransform: upper ? 'uppercase' : 'none',
      color: color ?? DS.inkSoft, ...style,
    }}>{children}</span>
  )
}

export function Rule({ double = false, color = DS.ink, style = {} }: {
  double?: boolean; color?: string; style?: CSSProperties
}) {
  if (double) return <div style={{ borderTop: `1px solid ${color}`, borderBottom: `1px solid ${color}`, height: 3, ...style }} />
  return <div style={{ borderTop: `1px solid ${color}`, ...style }} />
}

export function PhotoPlaceholder({
  hue = 'sage', label, height = 280,
}: {
  hue?: 'sage' | 'ochre' | 'mist'; label?: string; height?: number | string
}) {
  const gradients = {
    sage: 'linear-gradient(165deg, #4a5a4e 0%, #2a3a2e 40%, #1a2420 100%)',
    ochre: 'linear-gradient(165deg, #8a6d3e 0%, #5a4828 60%, #2a2218 100%)',
    mist: 'linear-gradient(165deg, #6a7870 0%, #3a4a42 50%, #1a2420 100%)',
  }
  return (
    <div style={{ width: '100%', height, position: 'relative', background: gradients[hue], overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 40%),
          radial-gradient(circle at 70% 60%, rgba(0,0,0,0.2) 0%, transparent 50%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.18,
        backgroundImage: `repeating-linear-gradient(92deg, transparent 0 18px, rgba(0,0,0,0.7) 18px 22px, transparent 22px 48px, rgba(0,0,0,0.4) 48px 51px)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 55% 55%, transparent 20%, rgba(0,0,0,0.4) 85%)' }} />
      {label && (
        <div style={{
          position: 'absolute', top: 12, left: 14,
          fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'rgba(244,238,226,0.7)',
        }}>{label}</div>
      )}
    </div>
  )
}

export function Sparkline({ data, width = 90, height = 22, color }: {
  data: number[]; width?: number; height?: number; color?: string
}) {
  if (data.length === 0) return null
  const max = Math.max(...data), min = Math.min(...data)
  const step = width / Math.max(data.length - 1, 1)
  const range = max - min || 1
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ')
  const lastX = (data.length - 1) * step
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 2) - 1
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color ?? DS.ink} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="1.5" fill={color ?? DS.ink} />
    </svg>
  )
}

export function TrendChart({ data, height = 160 }: { data: number[]; height?: number }) {
  const max = Math.max(...data) || 1
  const w = 100 / Math.max(data.length, 1)
  return (
    <div style={{ position: 'relative', height, borderLeft: `1px solid ${DS.ink}`, borderBottom: `1px solid ${DS.ink}`, paddingLeft: 2 }}>
      <div style={{
        position: 'absolute', right: 0, top: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%',
      }}>
        {[max, Math.round(max * 0.66), Math.round(max * 0.33), 0].map((v, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: -6, fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.1em', color: DS.inkSoft }}>{v}</div>
          </div>
        ))}
      </div>
      <svg width="100%" height={height - 1} style={{ overflow: 'visible', display: 'block', paddingRight: 24 }} preserveAspectRatio="none" viewBox={`0 0 100 ${height}`}>
        {data.map((v, i) => (
          <rect
            key={i}
            x={i * w + 0.2} y={height - (v / max) * (height - 4)}
            width={Math.max(w - 0.4, 0.1)} height={(v / max) * (height - 4)}
            fill={i === data.length - 1 ? DS.ochre : DS.forest}
            opacity={i === data.length - 1 ? 1 : 0.78}
          />
        ))}
      </svg>
    </div>
  )
}

export function StatBlock({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div style={{ padding: '18px 22px', borderRight: `0.5px solid ${DS.inkHair}`, flex: 1 }}>
      <Mono size={9} letter={0.22}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 52, fontWeight: 200, letterSpacing: '-0.03em',
        color: accent ?? DS.ink, lineHeight: 1, marginTop: 8,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic', fontWeight: 300,
          color: DS.inkSoft, marginTop: 6,
        }}>{sub}</div>
      )}
    </div>
  )
}

export function CatDot({ cat }: { cat: string }) {
  return (
    <div style={{
      width: 22, height: 22, border: `0.5px solid ${DS.ink}`, borderRadius: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.05em', color: DS.forest, fontWeight: 500,
    }}>{catLetter(cat)}</div>
  )
}

export function ConfPill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const c = pct >= 80 ? DS.forest : pct >= 50 ? DS.ochre : DS.rust
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 36, height: 4, background: DS.inkHair, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, right: 'auto', width: `${pct}%`, background: c }} />
      </div>
      <Mono size={10} letter={0.1} color={c}>{pct}%</Mono>
    </div>
  )
}

export function FlagTag({ flag }: { flag: string | null }) {
  if (!flag) return null
  const map: Record<string, { label: string; color: string }> = {
    'low-confidence': { label: 'LOW CONF', color: DS.rust },
    'with-young': { label: 'W/YOUNG', color: DS.ochre },
    'large-herd': { label: 'HERD', color: DS.forest },
    'needs-id': { label: 'NEEDS ID', color: DS.rust },
  }
  const m = map[flag]
  if (!m) return null
  return (
    <span style={{
      padding: '2px 6px', border: `0.5px solid ${m.color}`, color: m.color,
      fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
    }}>{m.label}</span>
  )
}
