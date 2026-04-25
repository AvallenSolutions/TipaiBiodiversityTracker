import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '@/context/AuthContext'
import { useGeolocation, formatCoordinates } from '@/hooks/useGeolocation'
import { useSpecies } from '@/hooks/useSpecies'
import { supabase } from '@/lib/supabase'
import { uploadMedia } from '@/lib/storage'
import { savePendingSighting } from '@/lib/offline'
import { identifySpecies, isGeminiAvailable } from '@/lib/gemini'
import { DS, normalizeConf } from '@/lib/ledger-design'
import { Blank, ConfidenceDial, PickerSheet, Mono, MonoIcon } from '@/components/logger/shared'
import type { SightingCategory, AISuggestion, MediaType } from '@/types'

interface CapturedMedia {
  blob: Blob
  type: MediaType
}

type Step = 'camera' | 'identifying' | 'identify' | 'entry' | 'sealed'

const BEHAVIOURS = ['Resting', 'Feeding', 'Moving', 'Stalking', 'Alert', 'Calling', 'Grooming', 'Mating', 'With young']
const HABITATS = ['Sal forest', 'Bamboo', 'Grassland', 'Riverine', 'Water body', 'Rocky outcrop', 'Cultivated', 'Scrub']
const WEATHERS = ['Clear', 'Overcast', 'Misty', 'Rain', 'After rain', 'Windy', 'Hot', 'Cold']
const SEX_AGE = ['Adult male', 'Adult female', 'Subadult', 'Juvenile', 'Cub / fawn', 'Mixed group', 'Unknown']
const CONFIDENCE = ['Certain', 'Likely', 'Uncertain']
const CATEGORIES: SightingCategory[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace']

export default function NewSightingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { location, getLocation, error: locationError, loading: locationLoading } = useGeolocation()
  const [skipLocation, setSkipLocation] = useState(false)
  const { species, fetchSpecies } = useSpecies()

  const [step, setStep] = useState<Step>('camera')
  const [category, setCategory] = useState<SightingCategory | null>(null)
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Entry fields
  const [selectedSpecies, setSelectedSpecies] = useState<AISuggestion | null>(null)
  const [linkedSpeciesId, setLinkedSpeciesId] = useState<string | null>(null)
  const [count, setCount] = useState(1)
  const [sexAge, setSexAge] = useState('Adult male')
  const [behaviour, setBehaviour] = useState('Resting')
  const [habitat, setHabitat] = useState('Sal forest')
  const [weather, setWeather] = useState('Overcast')
  const [confidence, setConfidence] = useState('Likely')
  const [notes, setNotes] = useState('')
  const [picker, setPicker] = useState<string | null>(null)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sealedOffline, setSealedOffline] = useState(false)

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Chrome iOS (WKWebView) can't reliably open the camera via any API — we show
  // an overlay directing those users to Safari. Safari iOS fully supports
  // getUserMedia in PWA standalone mode with a one-time permission dialog.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const isChromeIOS = isIOS && /CriOS/.test(navigator.userAgent)
  // Only Chrome iOS falls back to file input (library only — camera is broken).
  // Safari iOS and all other platforms use getUserMedia for the live viewfinder.
  const useNativeCapture = isChromeIOS

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (useNativeCapture) return   // handled by file input, no getUserMedia needed
    setCameraError(null)
    stopStream()
    const attach = (stream: MediaStream) => {
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        v.play().catch(() => {})
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      attach(stream)
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        attach(stream)
      } catch (err: any) {
        setCameraError(err.message || 'Camera access denied')
      }
    }
  }, [stopStream, useNativeCapture])

  // Used by both the canvas capture (non-iOS) and native file input (iOS)
  const commitBlob = useCallback((blob: Blob) => {
    setCapturedMedia(prev => [...prev, { blob, type: 'photo' }])
    setStep('identifying')
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => { if (blob) commitBlob(blob) }, 'image/jpeg', 0.85)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    commitBlob(file)
    e.target.value = ''
  }

  useEffect(() => {
    if (step === 'camera') {
      startCamera()
      return () => stopStream()
    }
  }, [step, startCamera, stopStream])

  useEffect(() => {
    if (step === 'identifying') {
      const photo = capturedMedia[capturedMedia.length - 1]
      const timer = setTimeout(() => {
        setAiError(null)
        if (photo?.type === 'photo' && isGeminiAvailable()) {
          setAiLoading(true)
          identifySpecies(photo.blob, category)
            .then(suggestions => {
              setAiSuggestions(suggestions)
              // Auto-apply the category from the top suggestion if user didn't pick one
              const topCat = suggestions[0]?.category as SightingCategory | undefined
              if (!category && topCat && CATEGORIES.includes(topCat)) setCategory(topCat)
            })
            .catch(err => {
              console.error('[identifySpecies] failed', err)
              setAiError(err?.message || String(err))
              setAiSuggestions([])
            })
            .finally(() => {
              setAiLoading(false)
              setStep('identify')
            })
        } else {
          if (!isGeminiAvailable()) setAiError('VITE_GEMINI_API_KEY not found in env — is it set on Netlify and did you redeploy?')
          else if (!navigator.onLine) setAiError('Offline — AI identification skipped.')
          setStep('identify')
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [step, capturedMedia, category])

  // Trigger geolocation as soon as the user enters the log flow so the
  // permission dialog and GPS lookup run in parallel with the photo
  // capture and AI identification, instead of starting only when the
  // user lands on the entry view (where they may submit before the
  // fix resolves and end up persisting 0,0).
  useEffect(() => {
    if (step === 'camera' || step === 'identifying' || step === 'entry') {
      if (!location) getLocation()
    }
  }, [step, location, getLocation])

  async function handleSubmit() {
    if (!category || !user) return
    // GPS is required online; offline we let the naturalist explicitly
    // skip if the receiver can't lock (indoors, cold-start failure, etc.).
    if (!location && !skipLocation) {
      setSubmitError(
        navigator.onLine
          ? 'Waiting for GPS — please allow location access and try again.'
          : 'Waiting for GPS. If you can\'t get a fix, tap "Save without location" below; you can add it on sync.'
      )
      getLocation()
      return
    }
    setSubmitting(true)
    setSubmitError(null)

    const sightingId = uuidv4()
    const now = new Date().toISOString()
    const lat = location?.latitude ?? null
    const lng = location?.longitude ?? null
    const wasOffline = !navigator.onLine

    try {
      if (navigator.onLine) {
        const mediaRecords: { path: string; type: MediaType; mime: string }[] = []
        for (let i = 0; i < capturedMedia.length; i++) {
          const m = capturedMedia[i]!
          const { path } = await uploadMedia(user.id, sightingId, m.blob, m.type, i)
          mediaRecords.push({ path, type: m.type, mime: m.blob.type })
        }

        const { error: sightingError } = await (supabase.from('sightings') as any).insert({
          id: sightingId,
          user_id: user.id,
          species_id: linkedSpeciesId,
          category,
          common_name: selectedSpecies?.common_name || null,
          scientific_name: selectedSpecies?.scientific_name || null,
          notes: notes || null,
          latitude: lat,
          longitude: lng,
          location_accuracy: location?.accuracy ?? null,
          sighted_at: now,
          verification_status: 'unverified',
          ai_confidence: selectedSpecies?.confidence ?? null,
          ai_suggestions: aiSuggestions.length > 0 ? aiSuggestions : null,
          individual_count: count,
        })
        if (sightingError) throw sightingError

        if (mediaRecords.length > 0) {
          const { error: mediaError } = await (supabase.from('sighting_media') as any).insert(
            mediaRecords.map((m, i) => ({
              id: uuidv4(),
              sighting_id: sightingId,
              media_type: m.type,
              storage_path: m.path,
              mime_type: m.mime,
              size_bytes: capturedMedia[i]!.blob.size,
            }))
          )
          if (mediaError) throw mediaError
        }
      } else {
        await savePendingSighting({
          id: sightingId,
          user_id: user.id,
          species_id: linkedSpeciesId,
          category,
          common_name: selectedSpecies?.common_name || null,
          scientific_name: selectedSpecies?.scientific_name || null,
          notes: notes || null,
          latitude: lat,
          longitude: lng,
          location_accuracy: location?.accuracy ?? null,
          sighted_at: now,
          ai_suggestions: aiSuggestions.length > 0 ? aiSuggestions : null,
          ai_confidence: selectedSpecies?.confidence ?? null,
          individual_count: count,
          media: capturedMedia.map(m => ({
            blob: m.blob,
            type: m.type,
            mime_type: m.blob.type,
          })),
          created_at: now,
        })
      }

      setSealedOffline(wasOffline)
      setStep('sealed')
      setTimeout(() => navigate('/', { replace: true }), wasOffline ? 4000 : 2500)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save sighting')
      setSubmitting(false)
    }
  }

  const open = (kind: string) => () => setPicker(kind)

  // ─── Step: Camera (pure black viewfinder) ───────────────────────────

  if (step === 'camera') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#000', display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Viewfinder — always a live video; Chrome iOS shows overlay on top */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

          {/* HUD */}
          <div style={{
            position: 'absolute', top: 16, left: 0, right: 0, padding: '0 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Mono size={9} color={DS.ivory} letter={0.22}>✕ Cancel</Mono>
            </button>
            <Mono size={9} color={DS.ochre} letter={0.22}>● REC</Mono>
            <Mono size={9} color="rgba(255,255,255,0.4)" letter={0.22}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Mono>
          </div>

          {/* getUserMedia error */}
          {cameraError && !isChromeIOS && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              padding: 32, gap: 16, background: 'rgba(0,0,0,0.85)',
            }}>
              <Mono size={9} color={DS.rust} letter={0.15} style={{ textAlign: 'center', lineHeight: 1.6 }}>
                {cameraError}
              </Mono>
              <button onClick={startCamera} style={{
                background: DS.ivory, color: DS.ink, border: 'none',
                fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em',
                padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase',
              }}>Retry</button>
            </div>
          )}

          {/* Chrome iOS: camera is broken. Overlay a "switch to Safari" message
              so users aren't left staring at a black screen. Photo Library still
              works via the shutter / action sheet below. */}
          {isChromeIOS && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              padding: '32px 24px', gap: 18, background: 'rgba(0,0,0,0.92)',
            }}>
              <Mono size={9} color={DS.ochre} letter={0.22}>◆ A note on Chrome for iPhone</Mono>
              <div style={{
                fontFamily: DS.serif, fontSize: 22, fontWeight: 300,
                lineHeight: 1.25, color: DS.ivory, textAlign: 'center',
                letterSpacing: '-0.01em', maxWidth: 320,
              }}>
                Chrome on iPhone can't open the camera.<br />
                <em style={{ color: 'rgba(232,226,211,0.65)' }}>Please use Safari.</em>
              </div>
              <div style={{
                fontFamily: DS.serif, fontSize: 14, fontWeight: 300, fontStyle: 'italic',
                color: 'rgba(232,226,211,0.55)', textAlign: 'center',
                lineHeight: 1.55, maxWidth: 300,
              }}>
                Tap the <span style={{ fontFamily: DS.mono, color: DS.ochre }}>⋯</span> menu
                in Chrome, then choose <em>"Open in Safari"</em>. Or select from your
                photo library with the shutter below.
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href).catch(() => {})
                }}
                style={{
                  background: 'transparent', color: DS.ivory,
                  border: `0.5px solid rgba(232,226,211,0.4)`,
                  fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
                  padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >Copy link</button>
            </div>
          )}
        </div>

        {/* Category strip */}
        <div style={{
          background: '#000', padding: '12px 20px 0',
          display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
        } as React.CSSProperties}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              flexShrink: 0,
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: category === cat ? DS.ink : DS.ivory,
              background: category === cat ? DS.ochre : 'rgba(255,255,255,0.12)',
              border: category === cat ? 'none' : '0.5px solid rgba(255,255,255,0.2)',
              padding: '6px 12px', cursor: 'pointer',
            }}>{cat}</button>
          ))}
        </div>

        {/* Shutter row */}
        <div style={{
          padding: '16px 0 20px', background: '#000',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          {isChromeIOS ? (
            /* Chrome iOS can't take photos — shutter opens Photo Library only */
            <>
              <label htmlFor="native-camera-input" style={{
                width: 76, height: 76, borderRadius: 38,
                border: `1.5px solid rgba(255,255,255,0.4)`,
                background: 'none', cursor: 'pointer',
                position: 'relative', display: 'block',
              }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
              </label>
              <Mono size={9} color="rgba(255,255,255,0.3)" letter={0.22} style={{ textAlign: 'center' }}>
                Choose from library
              </Mono>
            </>
          ) : (
            /* getUserMedia path: direct canvas capture, one tap */
            <button onClick={handleCapture} disabled={!!cameraError} style={{
              width: 76, height: 76, borderRadius: 38,
              border: `1.5px solid ${DS.ivory}`,
              background: 'none', cursor: cameraError ? 'not-allowed' : 'pointer',
              position: 'relative', opacity: cameraError ? 0.3 : 1,
            }}>
              <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: DS.ivory }} />
            </button>
          )}
        </div>

        <input id="native-camera-input" type="file" accept="image/*"
          onChange={handleFileSelect} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  // ─── Step: Identifying (interstitial) ──────────────────────────────

  if (step === 'identifying') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, background: '#0b0e0c', color: DS.ivory,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: DS.serif, fontSize: 28, fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              <div style={{ marginBottom: 8 }}>→ Reading the frame</div>
              <div style={{ opacity: 0.4, marginBottom: 8 }}>Consulting the field guide</div>
              <div style={{ opacity: 0.4 }}>Ranking candidates</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Step: Identify (telegram sheet) ───────────────────────────────

  if (step === 'identify') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, background: '#0b0e0c',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: DS.bone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mono size={10} color={DS.inkFaint} letter={0.22}>Photo preview</Mono>
        </div>

        <div style={{
          flex: 1, background: DS.ivory, borderRadius: '16px 16px 0 0',
          padding: '24px 20px 0', overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            paddingBottom: 12, borderBottom: `1px solid ${DS.ink}`,
          }}>
            <div>
              <Mono size={10} letter={0.22} color={DS.ochre}>◆ Telegram</Mono>
              <h2 style={{ fontFamily: DS.serif, fontSize: 18, fontWeight: 400, margin: '4px 0 0', color: DS.ink }}>The field guide reports</h2>
            </div>
            {aiSuggestions[0] && <ConfidenceDial value={normalizeConf(aiSuggestions[0].confidence)} size={48} />}
          </div>

          {aiError && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: 'rgba(184,90,61,0.08)',
              border: `0.5px solid ${DS.rust}`,
            }}>
              <Mono size={9} color={DS.rust} letter={0.15} style={{ lineHeight: 1.6, wordBreak: 'break-word' }}>
                AI unavailable: {aiError}
              </Mono>
            </div>
          )}

          {aiLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Mono size={10} color={DS.inkFaint} letter={0.22}>⋯ Analyzing</Mono>
            </div>
          ) : aiSuggestions.length > 0 ? (
            <>
              {aiSuggestions.map((s, idx) => {
                const isPrimary = idx === 0
                const cat = (s.category ?? category ?? 'sub').toString().slice(0, 3).toUpperCase()
                const label = isPrimary ? `${cat} · PRIMARY` : `${cat} · ALT ${String(idx + 1).padStart(2, '0')}`
                const confPct = Math.round(normalizeConf(s.confidence) * 100)
                return (
                  <button
                    key={`${s.common_name}-${idx}`}
                    onClick={() => { setSelectedSpecies(s); setStep('entry') }}
                    style={{
                      textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: isPrimary ? '20px 0 22px' : '16px 0 18px',
                      borderBottom: `0.5px solid ${DS.inkHair}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Mono size={9} letter={0.2} color={DS.inkSoft}>{label}</Mono>
                      <div style={{
                        fontFamily: DS.serif,
                        fontSize: isPrimary ? 36 : 22,
                        fontWeight: 300,
                        color: DS.ink, letterSpacing: '-0.02em',
                        lineHeight: 1.05, marginTop: 8,
                      }}>{s.common_name}</div>
                      {s.scientific_name && (
                        <div style={{
                          fontFamily: DS.serif,
                          fontSize: isPrimary ? 16 : 13,
                          fontStyle: 'italic', fontWeight: 300, color: DS.inkSoft, marginTop: 4,
                        }}>{s.scientific_name}</div>
                      )}
                    </div>
                    {!isPrimary && confPct > 0 && (
                      <Mono size={9} color={DS.inkSoft} letter={0.18}>{confPct}%</Mono>
                    )}
                  </button>
                )
              })}

              <button onClick={() => { setSelectedSpecies(null); setStep('entry'); }} style={{
                background: 'transparent', border: 'none', padding: '16px 0 24px',
                borderTop: `0.5px solid ${DS.ink}`, cursor: 'pointer', textAlign: 'center',
                fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: DS.ink,
              }}>
                None of these — identify by hand
              </button>
            </>
          ) : (
            <button onClick={() => setStep('entry')} style={{
              background: 'transparent', border: 'none', padding: '20px',
              cursor: 'pointer', textAlign: 'center',
              fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
              color: DS.ink,
            }}>Continue without AI →</button>
          )}
        </div>
      </div>
    )
  }

  // ─── Step: Entry (journal page) ────────────────────────────────────

  if (step === 'entry') {
    const when = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const coords = location ? formatCoordinates(location.latitude, location.longitude) : '⋯ acquiring GPS'

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, background: DS.ivory,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '58px 20px 12px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-end',
          borderBottom: `1px solid ${DS.ink}`,
        }}>
          <div>
            <Mono size={10} letter={0.22} color={DS.ochre}>◆ The Entry</Mono>
            <h1 style={{ fontFamily: DS.serif, fontSize: 26, fontWeight: 300, margin: '2px 0 0', color: DS.ink }}>№ 0001 · {when}</h1>
          </div>
          <button onClick={() => setStep('camera')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.ink, textTransform: 'uppercase',
          }}>← Back</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{
            padding: '24px 22px 16px',
            fontFamily: DS.serif, fontSize: 18, fontWeight: 300, lineHeight: 1.75,
            color: DS.ink, letterSpacing: '-0.005em',
          }}>
            <span style={{
              fontFamily: DS.serif, fontSize: 48, fontWeight: 200,
              float: 'left', lineHeight: 0.85, marginRight: 6, marginTop: 2,
              fontStyle: 'italic', color: DS.ink,
            }}>O</span>
            n the morning of <strong style={{ fontWeight: 400 }}>{when}</strong>, at <strong style={{ fontWeight: 400 }}>{time}</strong>, I observed{' '}
            <Blank onClick={open('count')} placeholder="how many?">{count}</Blank>{' '}
            <Blank onClick={open('sexAge')} placeholder="sex & age">{sexAge.toLowerCase()}</Blank>{' '}
            <Blank onClick={open('species')} placeholder="which species?">
              {selectedSpecies?.common_name
                ? <>{selectedSpecies.common_name}{selectedSpecies.scientific_name && <em style={{ fontWeight: 300, marginLeft: 4 }}>({selectedSpecies.scientific_name})</em>}</>
                : null}
            </Blank> — behaviour:{' '}
            <Blank onClick={open('behaviour')} placeholder="what?">{behaviour.toLowerCase()}</Blank> — in{' '}
            <Blank onClick={open('habitat')} placeholder="habitat">{habitat.toLowerCase()}</Blank>, light{' '}
            <Blank onClick={open('weather')} placeholder="weather">{weather.toLowerCase()}</Blank>, at{' '}
            <strong style={{ fontWeight: 400, fontFamily: DS.mono, fontSize: 15, letterSpacing: '0.02em' }}>{coords}</strong>. Confidence:{' '}
            <Blank onClick={open('confidence')} placeholder="how sure?">{confidence.toLowerCase()}</Blank>.
          </div>

          <div style={{
            margin: '0 22px', padding: '16px 0 24px',
            borderTop: `0.5px solid ${DS.inkHair}`,
          }}>
            <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 8 }}>Notes</Mono>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Further observations…"
              style={{
                width: '100%', minHeight: 80, background: 'transparent',
                border: 'none', outline: 'none', resize: 'none',
                fontFamily: DS.serif, fontSize: 16, fontWeight: 300, fontStyle: 'italic',
                color: DS.ink, lineHeight: '24px',
                padding: '2px 0 0',
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 23px, rgba(28,37,32,0.12) 23px 24px)`,
                backgroundSize: '100% 24px',
              }}
            />
          </div>

          <div style={{ height: 120 }} />
        </div>

        <div style={{ padding: '14px 20px max(32px, env(safe-area-inset-bottom))', borderTop: `0.5px solid ${DS.inkHair}`, background: DS.ivory }}>
          {submitError && (
            <div style={{
              padding: '10px 14px', background: DS.rust, color: DS.ivory,
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em',
              marginBottom: 12, textTransform: 'uppercase',
            }}>{submitError}</div>
          )}
          {locationError && !location && (
            <div style={{
              padding: '10px 14px', background: 'rgba(184,90,61,0.08)',
              border: `0.5px solid ${DS.rust}`,
              marginBottom: 12,
            }}>
              <Mono size={9} color={DS.rust} letter={0.15} style={{ lineHeight: 1.6 }}>
                GPS: {locationError}
              </Mono>
            </div>
          )}
          {!navigator.onLine && (
            <Mono size={9} color={DS.ochre} letter={0.18} style={{ display: 'block', marginBottom: 10, textAlign: 'center' }}>
              Offline · the entry will be held on the device and synced on signal
            </Mono>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || (!location && !skipLocation)}
            style={{
              width: '100%', padding: '18px 20px',
              background: (!location && !skipLocation) ? DS.inkFaint : DS.ochre, color: DS.ink,
              border: 'none',
              cursor: submitting || (!location && !skipLocation) ? 'not-allowed' : 'pointer',
              fontFamily: DS.mono, fontSize: 12, letterSpacing: '0.3em',
              textTransform: 'uppercase', fontWeight: 500,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting
              ? 'Sealing…'
              : !location && !skipLocation
                ? (locationLoading ? 'Acquiring GPS…' : 'Waiting for GPS…')
                : skipLocation && !location
                  ? 'Save without location ⎘'
                  : navigator.onLine
                    ? 'Seal the entry ⎘'
                    : 'Save offline ⎘'}
          </button>
          {!location && !navigator.onLine && (
            <button
              onClick={() => setSkipLocation(true)}
              disabled={skipLocation}
              style={{
                width: '100%', padding: '12px 16px', marginTop: 10,
                background: 'transparent', color: DS.inkSoft,
                border: `0.5px solid ${DS.inkFaint}`,
                cursor: skipLocation ? 'default' : 'pointer',
                fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
                textTransform: 'uppercase',
                opacity: skipLocation ? 0.5 : 1,
              }}
            >
              {skipLocation ? '✓ Will save without location' : 'Save without location'}
            </button>
          )}
        </div>

        {picker === 'count' && (
          <PickerSheet title="Number of individuals" numeric value={count}
            onChoose={(v) => { setCount(Number(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'sexAge' && (
          <PickerSheet title="Sex & age class" options={SEX_AGE} value={sexAge}
            onChoose={(v) => { setSexAge(String(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'behaviour' && (
          <PickerSheet title="Behaviour" options={BEHAVIOURS} value={behaviour}
            onChoose={(v) => { setBehaviour(String(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'habitat' && (
          <PickerSheet title="Habitat" options={HABITATS} value={habitat}
            onChoose={(v) => { setHabitat(String(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'weather' && (
          <PickerSheet title="Weather" options={WEATHERS} value={weather}
            onChoose={(v) => { setWeather(String(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'confidence' && (
          <PickerSheet title="Confidence" options={CONFIDENCE} value={confidence}
            onChoose={(v) => { setConfidence(String(v)); setPicker(null); }}
            onClose={() => setPicker(null)} />
        )}
        {picker === 'species' && (
          <SpeciesInputSheet
            initialCommon={selectedSpecies?.common_name ?? ''}
            initialScientific={selectedSpecies?.scientific_name ?? ''}
            librarySpecies={species}
            fetchSpecies={fetchSpecies}
            onPickFromLibrary={(sp) => {
              setSelectedSpecies({
                species: sp.common_name,
                common_name: sp.common_name,
                scientific_name: sp.scientific_name ?? null,
                confidence: 1,
                description: sp.description,
                category: sp.category,
              })
              setLinkedSpeciesId(sp.id)
              if (!category) setCategory(sp.category)
              setPicker(null)
            }}
            onSaveManual={(common, scientific) => {
              setSelectedSpecies({
                species: common,
                common_name: common,
                scientific_name: scientific || null,
                confidence: 0,
                description: null,
                category: category ?? undefined,
              })
              setLinkedSpeciesId(null)
              setPicker(null)
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    )
  }

  // ─── Step: Sealed (success) ───────────────────────────────────────

  if (step === 'sealed') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, background: DS.ivory,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 40px', gap: 28,
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 70,
          background: `radial-gradient(circle at 38% 38%, ${DS.ochre} 0%, #8a6d3e 85%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px rgba(138,109,62,0.3)`,
          animation: 'animate-seal-in 700ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{ textAlign: 'center', color: DS.ink, zIndex: 1 }}>
            <div style={{ fontFamily: DS.serif, fontSize: 32, fontWeight: 300, fontStyle: 'italic' }}>WL</div>
            <Mono size={7} letter={0.25} style={{ marginTop: 4 }}>№ 0001</Mono>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Mono size={10} letter={0.25} color={DS.ochre} style={{ marginBottom: 12 }}>
            {sealedOffline ? 'Held locally' : 'Entry sealed'}
          </Mono>
          <h2 style={{
            fontFamily: DS.serif, fontSize: 32, fontWeight: 300,
            letterSpacing: '-0.02em', color: DS.ink, lineHeight: 1.1,
          }}>
            {selectedSpecies?.common_name || 'Unidentified'}<br />
            <em style={{ fontWeight: 300, color: DS.inkSoft }}>
              {sealedOffline
                ? 'is saved on the device.'
                : 'has been entered into the logbook.'}
            </em>
          </h2>
          {sealedOffline && (
            <p style={{
              marginTop: 18, maxWidth: 360,
              fontFamily: DS.serif, fontSize: 15, fontStyle: 'italic',
              fontWeight: 300, color: DS.inkSoft, lineHeight: 1.5,
            }}>
              Open the app on signal to sync this sighting to the logbook. The
              upload happens automatically the moment you're back online.
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}

function SpeciesInputSheet({
  initialCommon, initialScientific, librarySpecies, fetchSpecies,
  onPickFromLibrary, onSaveManual, onClose,
}: {
  initialCommon: string
  initialScientific: string
  librarySpecies: import('@/types').Species[]
  fetchSpecies: (cat?: SightingCategory, search?: string) => void
  onPickFromLibrary: (sp: import('@/types').Species) => void
  onSaveManual: (common: string, scientific: string) => void
  onClose: () => void
}) {
  const [common, setCommon] = useState(initialCommon)
  const [scientific, setScientific] = useState(initialScientific)

  useEffect(() => {
    const t = setTimeout(() => fetchSpecies(undefined, common.trim() || undefined), 250)
    return () => clearTimeout(t)
  }, [common, fetchSpecies])

  const matches = common.trim()
    ? librarySpecies.slice(0, 6)
    : []

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
    fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
    color: DS.ink, outline: 'none',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(11,14,12,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: DS.ivory, padding: '18px 20px max(40px, env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 12, borderBottom: `1px solid ${DS.ink}`,
        }}>
          <Mono size={10} letter={0.2}>Identify the species</Mono>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Close</button>
        </div>

        <div style={{ paddingTop: 18 }}>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Common name</Mono>
          <input
            autoFocus value={common} onChange={(e) => setCommon(e.target.value)}
            placeholder="e.g. Sambar Deer"
            style={inputStyle}
          />
        </div>

        {matches.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Mono size={8} letter={0.2} color={DS.inkFaint} style={{ marginBottom: 6 }}>
              In the library
            </Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {matches.map(sp => (
                <button
                  key={sp.id}
                  onClick={() => onPickFromLibrary(sp)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                    padding: '12px 0', textAlign: 'left',
                    borderBottom: `0.5px solid ${DS.inkHair}`,
                    background: 'transparent', border: 'none', borderTop: 'none',
                    borderLeft: 'none', borderRight: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: DS.serif, fontSize: 16, fontWeight: 400, color: DS.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{sp.common_name}</div>
                    {sp.scientific_name && (
                      <div style={{
                        fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic',
                        fontWeight: 300, color: DS.inkSoft,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{sp.scientific_name}</div>
                    )}
                  </div>
                  <Mono size={8} letter={0.18} color={DS.inkFaint}>{sp.category.toUpperCase()}</Mono>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ paddingTop: 18 }}>
          <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>
            Scientific name <span style={{ color: DS.inkFaint }}>(optional)</span>
          </Mono>
          <input
            value={scientific} onChange={(e) => setScientific(e.target.value)}
            placeholder="e.g. Rusa unicolor"
            style={inputStyle}
          />
        </div>

        <button
          onClick={() => onSaveManual(common.trim(), scientific.trim())}
          disabled={!common.trim()}
          style={{
            marginTop: 22, width: '100%', padding: '16px 18px',
            background: common.trim() ? DS.ochre : DS.inkFaint, color: DS.ink, border: 'none',
            cursor: common.trim() ? 'pointer' : 'not-allowed',
            fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          Log as manual entry
        </button>
        <Mono size={8} letter={0.2} color={DS.inkFaint} style={{ marginTop: 8, textAlign: 'center' }}>
          A naturalist will review and may add it to the library
        </Mono>
      </div>
    </div>
  )
}
