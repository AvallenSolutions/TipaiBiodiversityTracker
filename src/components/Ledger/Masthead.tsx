import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { DS } from '../../lib/ledger-design'
import { useAuth } from '../../context/AuthContext'
import { Mono, Rule } from './shared'
import type { Sighting } from '../../types'

export type LedgerView = 'desk' | 'sighting' | 'species'

export function Masthead({
  view, onNav, selectedSighting, selectedSpecies, onSignOut, userInitials,
}: {
  view: LedgerView
  onNav: (v: LedgerView) => void
  selectedSighting?: Sighting | null
  selectedSpecies?: string | null
  onSignOut: () => void
  userInitials: string
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const tabs: { id: LedgerView; label: string }[] = [
    { id: 'desk', label: 'Front Desk' },
    { id: 'sighting', label: 'Sighting' },
    { id: 'species', label: 'Species' },
  ]

  const appNav: { path: string; label: string; active?: boolean }[] = [
    { path: '/',          label: 'Feed' },
    { path: '/new',       label: 'Log' },
    { path: '/species',   label: 'Library' },
    { path: '/dashboard', label: 'Ledger', active: true },
    ...(profile?.role === 'admin'
      ? [{ path: '/admin', label: 'Admin' }]
      : []),
  ]

  const now = new Date()
  const today = format(now, 'd MMMM yyyy')
  const dayName = format(now, 'EEEE')

  const title =
    view === 'desk'
      ? <>Today's <em style={{ fontStyle: 'italic', fontWeight: 300 }}>gatherings</em>.</>
      : view === 'sighting' && selectedSighting
      ? <>Sighting <em style={{ fontStyle: 'italic', fontWeight: 300 }}>№ {selectedSighting.id.slice(0, 4).toUpperCase()}</em>.</>
      : view === 'sighting'
      ? <>Recent <em style={{ fontStyle: 'italic', fontWeight: 300 }}>entries</em>.</>
      : view === 'species' && selectedSpecies
      ? <><em style={{ fontStyle: 'italic', fontWeight: 300 }}>{selectedSpecies}</em>.</>
      : <>The <em style={{ fontStyle: 'italic', fontWeight: 300 }}>library</em>.</>

  const subhead =
    view === 'desk' ? '◆ The Head Naturalist\'s Desk'
    : view === 'sighting' && selectedSighting ? '◆ A record under review'
    : view === 'sighting' ? '◆ Sightings · in review'
    : view === 'species' && selectedSpecies ? '◆ Species folio'
    : '◆ The library · admin'

  return (
    <div style={{
      background: DS.paper, borderBottom: `1px solid ${DS.ink}`,
      padding: '18px 40px 0', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `3px double ${DS.ink}`, paddingTop: 14, paddingBottom: 10,
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <img src="/wildlife-luxuries-logo.png" alt="Wildlife Luxuries"
               style={{ height: 46, width: 'auto', display: 'block' }} />
          <div style={{ borderLeft: `0.5px solid ${DS.inkFaint}`, height: 32 }} />
          <Mono size={9} color={DS.inkSoft}>The Ledger · Wildlife Luxuries</Mono>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 0 }} aria-label="Site sections">
          {appNav.map((item, idx) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: item.active ? DS.ink : 'transparent',
                color: item.active ? DS.ivory : DS.ink,
                border: `0.5px solid ${DS.ink}`,
                marginLeft: idx === 0 ? 0 : -0.5,
                cursor: 'pointer',
                fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
                textTransform: 'uppercase', padding: '8px 14px',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Mono size={9} color={DS.inkSoft}>{today} · {dayName}</Mono>
          <button onClick={onSignOut} style={{
            background: 'transparent', border: `0.5px solid ${DS.inkHair}`, cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: DS.inkSoft, padding: '6px 12px',
          }}>Sign Out</button>
          <div style={{
            width: 28, height: 28, borderRadius: 14, background: DS.forest,
            color: DS.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: DS.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
          }}>{userInitials}</div>
        </div>
      </div>

      <Rule double />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingTop: 22, paddingBottom: 16, flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ minWidth: 0 }}>
          <Mono size={10} color={DS.ochre} letter={0.25}>{subhead}</Mono>
          <h1 style={{
            fontFamily: DS.serif,
            fontSize: view === 'desk' ? 56 : 40,
            fontWeight: 200, letterSpacing: '-0.03em',
            lineHeight: 1.1, margin: '10px 0 0', color: DS.ink,
            paddingBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => onNav(t.id)} style={{
              padding: '10px 18px',
              background: view === t.id ? DS.ink : 'transparent',
              color: view === t.id ? DS.ivory : DS.ink,
              border: `0.5px solid ${DS.ink}`,
              marginLeft: -0.5, cursor: 'pointer',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>{t.label}</button>
          ))}
        </div>
      </div>
      <Rule />
    </div>
  )
}
