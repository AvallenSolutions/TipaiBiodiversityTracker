import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '@/context/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/lib/supabase'
import { uploadMedia } from '@/lib/storage'
import { identifySpecies, isGeminiAvailable } from '@/lib/gemini'
import { extractExif } from '@/lib/exif'
import { DS, normalizeConf } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import type { AISuggestion, SightingCategory } from '@/types'

type ItemStatus = 'queued' | 'identifying' | 'ready' | 'saving' | 'saved' | 'error'

interface UploadItem {
  id: string
  file: File
  previewUrl: string
  takenAt: Date | null
  exifLat: number | null
  exifLng: number | null
  cameraModel: string | null
  aiSuggestions: AISuggestion[]
  aiConfidence: number | null
  // Editable
  commonName: string
  scientificName: string
  category: SightingCategory
  notes: string
  // State
  status: ItemStatus
  errorMsg: string | null
}

const CATEGORIES: SightingCategory[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace']
const PROCESS_CONCURRENCY = 3

export default function BulkUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { location, getLocation } = useGeolocation()

  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch fallback location for photos with no EXIF GPS. The user picks
  // this once for the whole batch — either by tapping "Use my location"
  // or typing coordinates by hand.
  const [batchLat, setBatchLat] = useState<string>('')
  const [batchLng, setBatchLng] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [doneCount, setDoneCount] = useState<{ saved: number; failed: number } | null>(null)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Revoke object URLs when the page unmounts so we don't leak.
  useEffect(() => {
    return () => {
      items.forEach(it => URL.revokeObjectURL(it.previewUrl))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const processItem = useCallback(async (item: UploadItem) => {
    updateItem(item.id, { status: 'identifying' })
    try {
      const suggestions = isGeminiAvailable()
        ? await identifySpecies(item.file, null)
        : []
      const top = suggestions[0]
      updateItem(item.id, {
        status: 'ready',
        aiSuggestions: suggestions,
        aiConfidence: top?.confidence ?? null,
        commonName: top?.common_name || '',
        scientificName: top?.scientific_name || '',
        category: (top?.category as SightingCategory) || item.category,
      })
    } catch (err: any) {
      updateItem(item.id, {
        status: 'ready',
        errorMsg: err?.message || 'AI identification failed',
      })
    }
  }, [updateItem])

  // Process the queue with bounded concurrency so we don't fire 30 Gemini
  // calls at once. Re-runs whenever new items land in the queued state.
  useEffect(() => {
    const queued = items.filter(i => i.status === 'queued')
    const inFlight = items.filter(i => i.status === 'identifying').length
    const slots = Math.max(0, PROCESS_CONCURRENCY - inFlight)
    if (queued.length === 0 || slots === 0) return
    queued.slice(0, slots).forEach(processItem)
  }, [items, processItem])

  const onFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    const additions: UploadItem[] = []
    for (const file of list) {
      const exif = await extractExif(file)
      additions.push({
        id: uuidv4(),
        file,
        previewUrl: URL.createObjectURL(file),
        takenAt: exif.takenAt,
        exifLat: exif.latitude,
        exifLng: exif.longitude,
        cameraModel: exif.cameraModel,
        aiSuggestions: [],
        aiConfidence: null,
        commonName: '',
        scientificName: '',
        category: 'mammal',
        notes: '',
        status: 'queued',
        errorMsg: null,
      })
    }
    setItems(prev => [...prev, ...additions])
  }, [])

  const removeItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(i => i.id !== id)
    })
  }

  const useMyLocation = () => {
    getLocation()
  }
  // Mirror geolocation result into the batch lat/lng inputs once it lands.
  useEffect(() => {
    if (location && !batchLat && !batchLng) {
      setBatchLat(location.latitude.toFixed(6))
      setBatchLng(location.longitude.toFixed(6))
    }
  }, [location, batchLat, batchLng])

  const itemsMissingGps = items.filter(i => i.exifLat === null || i.exifLng === null).length
  const allReady = items.length > 0 && items.every(i => i.status === 'ready' || i.status === 'saved')
  const hasFallbackGps = batchLat.trim() !== '' && batchLng.trim() !== ''
  const fallbackLat = parseFloat(batchLat)
  const fallbackLng = parseFloat(batchLng)
  const fallbackValid = hasFallbackGps && !isNaN(fallbackLat) && !isNaN(fallbackLng)
  const canSubmit =
    !submitting &&
    isOnline &&
    items.length > 0 &&
    allReady &&
    (itemsMissingGps === 0 || fallbackValid)

  async function saveItem(item: UploadItem): Promise<boolean> {
    if (!user) return false
    updateItem(item.id, { status: 'saving' })
    try {
      const sightingId = uuidv4()
      const { path } = await uploadMedia(user.id, sightingId, item.file, 'photo', 0)

      const lat = item.exifLat ?? (fallbackValid ? fallbackLat : null)
      const lng = item.exifLng ?? (fallbackValid ? fallbackLng : null)
      const sightedAt = (item.takenAt ?? new Date()).toISOString()

      const { error: sightingErr } = await (supabase.from('sightings') as any).insert({
        id: sightingId,
        user_id: user.id,
        species_id: null,
        category: item.category,
        common_name: item.commonName.trim() || null,
        scientific_name: item.scientificName.trim() || null,
        notes: item.notes.trim() || null,
        latitude: lat,
        longitude: lng,
        location_accuracy: null,
        sighted_at: sightedAt,
        verification_status: 'unverified',
        ai_confidence: item.aiConfidence,
        ai_suggestions: item.aiSuggestions.length ? item.aiSuggestions : null,
        individual_count: 1,
      })
      if (sightingErr) throw sightingErr

      const { error: mediaErr } = await (supabase.from('sighting_media') as any).insert({
        id: uuidv4(),
        sighting_id: sightingId,
        media_type: 'photo',
        storage_path: path,
        mime_type: item.file.type,
        size_bytes: item.file.size,
      })
      if (mediaErr) throw mediaErr

      updateItem(item.id, { status: 'saved' })
      return true
    } catch (err: any) {
      updateItem(item.id, {
        status: 'error',
        errorMsg: err?.message || 'Failed to save',
      })
      return false
    }
  }

  async function handleSaveAll() {
    if (!canSubmit) return
    setSubmitting(true)
    const toSave = items.filter(i => i.status === 'ready')
    let saved = 0
    let failed = 0

    // Bounded-concurrency uploads — same idea as the processing queue.
    const queue = [...toSave]
    async function worker() {
      while (queue.length > 0) {
        const next = queue.shift()
        if (!next) return
        const ok = await saveItem(next)
        if (ok) saved++
        else failed++
      }
    }
    await Promise.all(Array.from({ length: PROCESS_CONCURRENCY }, () => worker()))

    setDoneCount({ saved, failed })
    setSubmitting(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────

  if (doneCount) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ The Upload</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 36, fontWeight: 200,
          letterSpacing: '-0.02em', margin: '8px 0 12px', color: DS.ink,
        }}>
          {doneCount.failed === 0
            ? `${doneCount.saved} sighting${doneCount.saved === 1 ? '' : 's'} added.`
            : `${doneCount.saved} saved · ${doneCount.failed} failed.`}
        </h1>
        <p style={{ fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', color: DS.inkSoft, marginBottom: 24 }}>
          The records are now in the journal. Naturalists can verify them in the ledger.
        </p>
        <button onClick={() => navigate('/')} style={primaryBtn}>Back to the feed</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 60px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic',
          color: DS.ink, padding: 0, marginBottom: 16,
        }}
      >← Back</button>

      <div style={{ borderTop: `3px double ${DS.ink}`, paddingTop: 12, marginBottom: 24 }}>
        <Mono size={9} letter={0.22} color={DS.ochre}>◆ The Upload</Mono>
        <h1 style={{
          fontFamily: DS.serif, fontSize: 36, fontWeight: 200,
          letterSpacing: '-0.02em', margin: '6px 0 4px', color: DS.ink,
        }}>
          Bulk import.
        </h1>
        <p style={{
          fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic', fontWeight: 300,
          color: DS.inkSoft, margin: 0, lineHeight: 1.45, maxWidth: 560,
        }}>
          Drop or pick photos from your SLR, phone library or SD card. Each becomes its own sighting; we'll read the time and GPS from EXIF where available, and identify the species with AI before you confirm.
        </p>
      </div>

      {!isOnline && (
        <div style={bannerWarn}>
          Bulk upload needs signal — AI identification and storage uploads can't run offline.
        </div>
      )}

      {/* Drop zone / file picker */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
        }}
        style={{
          padding: '40px 20px',
          border: `1px dashed ${dragOver ? DS.ochre : DS.ink}`,
          background: dragOver ? `${DS.ochre}14` : DS.bone,
          textAlign: 'center', cursor: 'pointer',
          marginBottom: 24,
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 8 }}>◆ Drop or choose</Mono>
        <div style={{
          fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
          color: DS.ink, letterSpacing: '-0.01em', marginBottom: 6,
        }}>
          {items.length === 0 ? 'Drop photos here' : `Add more · ${items.length} selected`}
        </div>
        <Mono size={9} letter={0.18} color={DS.inkSoft}>
          JPG · PNG · HEIC · multiple files supported
        </Mono>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={e => {
            if (e.target.files) onFiles(e.target.files)
            e.target.value = ''
          }}
          style={{ display: 'none' }}
        />
      </div>

      {/* Batch GPS fallback */}
      {itemsMissingGps > 0 && (
        <div style={{
          padding: '14px 16px', background: DS.bone,
          border: `0.5px solid ${DS.ink}`, marginBottom: 24,
        }}>
          <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 8 }}>
            ◆ Where were these photos taken?
          </Mono>
          <p style={{
            fontFamily: DS.serif, fontSize: 14, fontStyle: 'italic',
            color: DS.inkSoft, margin: '0 0 12px', lineHeight: 1.5,
          }}>
            {itemsMissingGps} photo{itemsMissingGps === 1 ? '' : 's'} {itemsMissingGps === 1 ? 'has' : 'have'} no GPS data. Set a single location for the batch — photos that do have GPS will use their own coordinates.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={useMyLocation} style={secondaryBtn}>Use my current location</button>
            <input
              placeholder="Latitude"
              value={batchLat}
              onChange={e => setBatchLat(e.target.value)}
              style={smallInput}
            />
            <input
              placeholder="Longitude"
              value={batchLng}
              onChange={e => setBatchLng(e.target.value)}
              style={smallInput}
            />
          </div>
        </div>
      )}

      {/* Photo grid */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {items.map(it => (
            <UploadRow
              key={it.id}
              item={it}
              fallbackGpsValid={fallbackValid}
              onChange={patch => updateItem(it.id, patch)}
              onRemove={() => removeItem(it.id)}
            />
          ))}
        </div>
      )}

      {/* Save */}
      {items.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, background: DS.paper,
          paddingTop: 16, borderTop: `1px solid ${DS.ink}`,
        }}>
          <button
            onClick={handleSaveAll}
            disabled={!canSubmit}
            style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            {submitting
              ? `⋯ Saving ${items.filter(i => i.status === 'saving' || i.status === 'saved').length} / ${items.length}`
              : `Save ${items.filter(i => i.status === 'ready').length} sighting${items.filter(i => i.status === 'ready').length === 1 ? '' : 's'}`}
          </button>
          {!allReady && !submitting && (
            <Mono size={9} color={DS.inkSoft} letter={0.2} style={{ marginTop: 8, textAlign: 'center', display: 'block' }}>
              ⋯ Identifying {items.filter(i => i.status === 'identifying' || i.status === 'queued').length} more
            </Mono>
          )}
        </div>
      )}
    </div>
  )
}

function UploadRow({
  item, onChange, onRemove, fallbackGpsValid,
}: {
  item: UploadItem
  fallbackGpsValid: boolean
  onChange: (patch: Partial<UploadItem>) => void
  onRemove: () => void
}) {
  const conf = normalizeConf(item.aiConfidence)
  const lat = item.exifLat
  const lng = item.exifLng
  const usingFallback = (lat === null || lng === null)
  const time = item.takenAt
  const isBusy = item.status === 'identifying' || item.status === 'saving'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '88px 1fr',
      gap: 12, padding: 12,
      border: `0.5px solid ${item.status === 'error' ? DS.rust : DS.inkHair}`,
      background: item.status === 'saved' ? `${DS.forest}10` : DS.ivory,
    }}>
      <img
        src={item.previewUrl}
        alt=""
        style={{ width: 88, height: 88, objectFit: 'cover', display: 'block', background: DS.bone }}
      />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Mono size={9} letter={0.18} color={DS.ochre}>
            {item.status === 'identifying' && '⋯ Identifying'}
            {item.status === 'queued' && '⋯ Queued'}
            {item.status === 'ready' && (item.aiConfidence != null ? `AI · ${Math.round(conf * 100)}%` : 'AI · —')}
            {item.status === 'saving' && '⋯ Saving'}
            {item.status === 'saved' && '● Saved'}
            {item.status === 'error' && '× Error'}
          </Mono>
          {item.cameraModel && (
            <Mono size={8} letter={0.15} color={DS.inkFaint}>{item.cameraModel}</Mono>
          )}
          <button
            onClick={onRemove}
            disabled={isBusy}
            style={{
              marginLeft: 'auto',
              background: 'transparent', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer',
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.18em',
              color: DS.inkSoft, textTransform: 'uppercase', padding: 0,
            }}
          >Remove</button>
        </div>

        <input
          value={item.commonName}
          onChange={e => onChange({ commonName: e.target.value })}
          placeholder={item.status === 'identifying' ? 'Identifying…' : 'Common name'}
          disabled={isBusy}
          style={rowInputBig}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 6 }}>
          <input
            value={item.scientificName}
            onChange={e => onChange({ scientificName: e.target.value })}
            placeholder="Scientific name"
            disabled={isBusy}
            style={rowInputItalic}
          />
          <select
            value={item.category}
            onChange={e => onChange({ category: e.target.value as SightingCategory })}
            disabled={isBusy}
            style={rowInputSmall}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Mono size={9} letter={0.15} color={DS.inkSoft}>
            {time ? time.toLocaleString() : 'Time: not in EXIF · using upload time'}
          </Mono>
          <Mono size={9} letter={0.15} color={usingFallback ? DS.ochre : DS.inkSoft}>
            {lat != null && lng != null
              ? `${lat.toFixed(4)}°N · ${lng.toFixed(4)}°E`
              : fallbackGpsValid
                ? 'GPS: batch fallback'
                : 'GPS: missing — set batch fallback above'}
          </Mono>
        </div>

        {item.errorMsg && (
          <Mono size={9} color={DS.rust} letter={0.15}>{item.errorMsg}</Mono>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '14px 18px',
  background: DS.ink, color: DS.ivory, border: 'none',
  fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: DS.ink, color: DS.ivory, border: 'none',
  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const smallInput: React.CSSProperties = {
  padding: '8px 10px', flex: '1 1 100px',
  border: `0.5px solid ${DS.ink}`, background: DS.paper,
  fontFamily: DS.mono, fontSize: 11, color: DS.ink, outline: 'none',
}
const rowInputBig: React.CSSProperties = {
  padding: '7px 10px',
  border: `0.5px solid ${DS.inkFaint}`, background: DS.paper,
  fontFamily: DS.serif, fontSize: 16, fontWeight: 400, color: DS.ink, outline: 'none',
}
const rowInputItalic: React.CSSProperties = {
  padding: '6px 10px',
  border: `0.5px solid ${DS.inkFaint}`, background: DS.paper,
  fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic', fontWeight: 300,
  color: DS.ink, outline: 'none',
}
const rowInputSmall: React.CSSProperties = {
  padding: '6px 10px',
  border: `0.5px solid ${DS.inkFaint}`, background: DS.paper,
  fontFamily: DS.mono, fontSize: 10, color: DS.ink, outline: 'none',
}
const bannerWarn: React.CSSProperties = {
  padding: '10px 14px', background: DS.rust, color: DS.ivory,
  fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
  marginBottom: 16,
}
