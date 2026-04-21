import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import { formatCoordinates } from '@/hooks/useGeolocation'
import { DS, normalizeConf } from '@/lib/ledger-design'
import { Mono, MonoIcon, ConfidenceDial } from '@/components/logger/shared'
import type { Sighting } from '@/types'

export default function SightingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [sighting, setSighting] = useState<Sighting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const fetchSighting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data, error: err } = await (supabase.from('sightings') as any)
        .select('*, sighting_media(*), profile:profiles!sightings_user_id_fkey(*)')
        .eq('id', id)
        .single()
      if (err) throw err
      setSighting(data as Sighting)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchSighting()
  }, [fetchSighting])

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Mono size={10} color={DS.inkFaint} letter={0.22}>⋯ Loading</Mono>
      </div>
    )
  }

  if (error || !sighting) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <Link to="/" style={{ color: DS.ink, textDecoration: 'none', marginBottom: 20, display: 'block' }}>
          ← Back to feed
        </Link>
        <div style={{ padding: '10px 14px', background: DS.rust, color: DS.ivory, fontFamily: DS.mono, fontSize: 10 }}>
          {error || 'Sighting not found'}
        </div>
      </div>
    )
  }

  const media = sighting.media || []
  const currentMedia = media[galleryIndex]
  const when = format(new Date(sighting.sighted_at), 'd MMM · HH:mm')
  const conf = normalizeConf(sighting.ai_confidence)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 40px' }}>
      {/* Back link */}
      <Link to="/" style={{
        display: 'inline-block', marginBottom: 20,
        fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic',
        color: DS.ink, textDecoration: 'none',
      }}>← Back to feed</Link>

      {/* Gallery */}
      {currentMedia && (
        <div style={{
          marginBottom: 24, position: 'relative',
          border: `1px solid ${DS.ink}`, overflow: 'hidden',
        }}>
          <img
            src={getMediaUrl(currentMedia.storage_path)}
            alt={sighting.common_name || 'Sighting'}
            style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'cover' }}
          />
          {media.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              fontFamily: DS.mono, fontSize: 9, color: DS.ivory,
              background: 'rgba(0,0,0,0.6)', padding: '4px 8px', letterSpacing: '0.1em',
            }}>{galleryIndex + 1} / {media.length}</div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ The Record</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 32, fontWeight: 300,
          letterSpacing: '-0.02em', margin: '6px 0 2px', color: DS.ink,
        }}>
          {sighting.common_name || 'Unidentified'}
        </h1>
        {sighting.scientific_name && (
          <p style={{
            fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic',
            fontWeight: 300, color: DS.inkSoft, margin: 0,
          }}>
            {sighting.scientific_name}
          </p>
        )}
      </div>

      {/* Meta row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16,
        padding: '12px 0', borderTop: `1px solid ${DS.ink}`, borderBottom: `1px solid ${DS.ink}`,
        marginBottom: 24,
      }}>
        <div>
          <Mono size={9} letter={0.22} color={DS.inkSoft}>When</Mono>
          <p style={{ fontFamily: DS.serif, fontSize: 15, margin: '4px 0 0', color: DS.ink }}>
            {when}
          </p>
        </div>
        <div>
          <Mono size={9} letter={0.22} color={DS.inkSoft}>Where</Mono>
          <p style={{ fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.05em', margin: '4px 0 0', color: DS.ink }}>
            {formatCoordinates(sighting.latitude, sighting.longitude)}
          </p>
        </div>
      </div>

      {/* Category & count */}
      {sighting.individual_count && (
        <div style={{ padding: '12px 0', borderBottom: `1px solid ${DS.ink}`, marginBottom: 24 }}>
          <Mono size={9} letter={0.22} color={DS.inkSoft}>Count</Mono>
          <p style={{ fontFamily: DS.serif, fontSize: 28, fontWeight: 200, margin: '4px 0 0', color: DS.ink, letterSpacing: '-0.03em' }}>
            × {String(sighting.individual_count).padStart(2, '0')}
          </p>
        </div>
      )}

      {/* AI suggestions */}
      {sighting.ai_suggestions && sighting.ai_suggestions.length > 0 && (
        <div style={{ marginBottom: 24, padding: '14px', background: DS.bone, border: `0.5px solid ${DS.ink}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <Mono size={9} letter={0.22} color={DS.ochre}>AI Reasoning</Mono>
            <ConfidenceDial value={conf} size={32} stroke={1.2} />
          </div>
          {sighting.ai_suggestions.map((s, i) => (
            <div key={i} style={{
              padding: '8px 0',
              borderTop: i === 0 ? 'none' : `0.5px solid ${DS.inkHair}`,
            }}>
              <p style={{
                fontFamily: DS.serif, fontSize: 14, fontWeight: 400,
                margin: '0 0 2px', color: DS.ink,
              }}>
                {s.common_name}
              </p>
              {s.scientific_name && (
                <p style={{
                  fontFamily: DS.serif, fontSize: 12, fontStyle: 'italic',
                  fontWeight: 300, margin: '0 0 4px', color: DS.inkSoft,
                }}>
                  {s.scientific_name}
                </p>
              )}
              {s.description && (
                <p style={{
                  fontFamily: DS.serif, fontSize: 13, fontWeight: 300,
                  fontStyle: 'italic', margin: 0, color: DS.ink,
                }}>
                  "{s.description}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {sighting.notes && (
        <div style={{ marginBottom: 24, padding: '14px', background: DS.bone, border: `0.5px solid ${DS.ink}` }}>
          <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 8 }}>Notes</Mono>
          <p style={{
            fontFamily: DS.serif, fontSize: 15, fontWeight: 300,
            lineHeight: 1.55, margin: 0, color: DS.ink, whiteSpace: 'pre-wrap',
          }}>
            {sighting.notes}
          </p>
        </div>
      )}

      {/* Observer */}
      <div style={{ paddingTop: 12, borderTop: `1px solid ${DS.ink}` }}>
        <Mono size={9} letter={0.22} color={DS.inkSoft}>Logged by</Mono>
        <p style={{
          fontFamily: DS.serif, fontSize: 15, fontWeight: 300,
          margin: '4px 0 0', color: DS.ink,
        }}>
          {sighting.profile?.display_name || sighting.profile?.email || 'Unknown'}
        </p>
      </div>
    </div>
  )
}
