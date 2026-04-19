import { CSSProperties } from 'react'
import { DS } from '../../lib/ledger-design'

export function Mono({
  children, size = 10, color, letter, style,
}: {
  children?: React.ReactNode
  size?: number
  color?: string
  letter?: number
  style?: CSSProperties
}) {
  return (
    <div style={{
      fontFamily: DS.mono, fontSize: size, color: color ?? DS.ink,
      letterSpacing: `${letter ?? 0.1}em`, textTransform: 'uppercase' as const,
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Rule({ double }: { double?: boolean }) {
  return (
    <div style={{
      borderTop: double ? `3px double ${DS.inkHair}` : `0.5px solid ${DS.inkHair}`,
      margin: 0,
    }} />
  )
}

export function PhotoPlaceholder({
  hue = 'ochre', height = 200, label,
}: {
  hue?: 'ochre' | 'mist' | 'sage'
  height?: number | string
  label?: string
}) {
  const bg = hue === 'ochre' ? DS.bone : hue === 'mist' ? '#D6DCE0' : '#C8D2C4'
  return (
    <div style={{
      height, background: bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8,
    }}>
      <div style={{ width: 32, height: 32, opacity: 0.25 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={DS.ink} strokeWidth={1}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M8 5V3M16 5V3" />
        </svg>
      </div>
      {label && <Mono size={8} color={`${DS.ink}40`} letter={0.2}>{label}</Mono>}
    </div>
  )
}

export function Sparkline({ data, height = 32 }: { data: number[]; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 120
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${height - (v / max) * height}`
  ).join(' ')
  return (
    <svg width={w} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={DS.ochre} strokeWidth={1.5} />
    </svg>
  )
}

export function TrendChart({ data, height = 120 }: { data: number[]; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 100
  const barW = w / data.length
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {data.map((v, i) => {
        const bh = (v / max) * height
        return (
          <rect
            key={i}
            x={i * barW + barW * 0.1}
            y={height - bh}
            width={barW * 0.8}
            height={bh}
            fill={DS.ochre}
            opacity={0.7}
          />
        )
      })}
    </svg>
  )
}

export function StatBlock({
  label, value, sub, accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div style={{
      padding: '20px 24px',
      borderRight: `0.5px solid ${DS.inkHair}`,
      background: accent ? DS.forest : 'transparent',
    }}>
      <Mono size={8} letter={0.22} color={accent ? DS.ivory : DS.inkSoft}>{label}</Mono>
      <div style={{
        fontFamily: DS.serif, fontSize: 40, fontWeight: 200,
        letterSpacing: '-0.03em', color: accent ? DS.ivory : DS.ink,
        lineHeight: 1.1, margin: '6px 0 2px',
      }}>{value}</div>
      {sub && <Mono size={8} letter={0.15} color={accent ? `${DS.ivory}99` : DS.inkFaint}>{sub}</Mono>}
    </div>
  )
}

export function CatDot({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    mammal: '#B8935A', bird: '#4A7FA5', reptile: '#6B8F5E',
    amphibian: '#5E8A8A', insect: '#A0503C', plant: '#3F5048',
    fungi: '#7B5E8A', trace: '#8A7B5E',
  }
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: 4,
      background: colors[cat] ?? DS.inkSoft, flexShrink: 0,
    }} />
  )
}

export function ConfPill({ conf }: { conf: number }) {
  const pct = Math.round(conf * 100)
  const bg = conf >= 0.8 ? DS.forest : conf >= 0.5 ? DS.ochre : DS.rust
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      background: bg, color: DS.ivory,
      fontFamily: DS.mono, fontSize: 9,
      letterSpacing: '0.1em',
    }}>{pct}%</span>
  )
}

export function FlagTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      background: DS.rust, color: DS.ivory,
      fontFamily: DS.mono, fontSize: 9,
      letterSpacing: '0.12em',
    }}>{label}</span>
  )
}
