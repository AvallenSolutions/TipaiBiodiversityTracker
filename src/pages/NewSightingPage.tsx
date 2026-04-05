import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Loader2,
  Sparkles,
  Search,
  Check,
  AlertCircle,
  Send,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '@/context/AuthContext'
import { useGeolocation, formatCoordinates } from '@/hooks/useGeolocation'
import { useSpecies } from '@/hooks/useSpecies'
import { supabase } from '@/lib/supabase'
import { uploadMedia } from '@/lib/storage'
import { savePendingSighting } from '@/lib/offline'
import { identifySpecies, isGeminiAvailable } from '@/lib/gemini'
import CategoryPicker from '@/components/sighting/CategoryPicker'
import MediaCapture from '@/components/sighting/MediaCapture'
import type { SightingCategory, AISuggestion, MediaType } from '@/types'

interface CapturedMedia {
  blob: Blob
  type: MediaType
}

const STEPS = ['Category', 'Media', 'Details'] as const
type Step = 0 | 1 | 2

export default function NewSightingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { location, loading: geoLoading, error: geoError, getLocation } = useGeolocation()
  const { species, fetchSpecies } = useSpecies()

  const [step, setStep] = useState<Step>(0)
  const [category, setCategory] = useState<SightingCategory | null>(null)
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([])

  // Step 3 form
  const [speciesSearch, setSpeciesSearch] = useState('')
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null)
  const [commonName, setCommonName] = useState('')
  const [scientificName, setScientificName] = useState('')
  const [notes, setNotes] = useState('')
  const [individualCount, setIndividualCount] = useState(1)

  // AI
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Auto-fetch GPS when entering step 3
  useEffect(() => {
    if (step === 2) {
      getLocation()
    }
  }, [step, getLocation])

  // Run AI identification when entering step 3 with photos
  useEffect(() => {
    if (step !== 2 || !category) return
    const photo = capturedMedia.find(m => m.type === 'photo')
    if (!photo || !isGeminiAvailable()) return

    let cancelled = false
    setAiLoading(true)
    identifySpecies(photo.blob, category)
      .then(suggestions => {
        if (!cancelled) setAiSuggestions(suggestions)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAiLoading(false)
      })

    return () => { cancelled = true }
  }, [step, category, capturedMedia])

  // Fetch species for search
  const handleSpeciesSearch = useCallback(
    (query: string) => {
      setSpeciesSearch(query)
      if (query.length >= 2) {
        fetchSpecies(category ?? undefined, query)
      }
    },
    [fetchSpecies, category]
  )

  function handleCategorySelect(cat: SightingCategory) {
    setCategory(cat)
    setStep(1)
  }

  function handleMediaCapture(blob: Blob, type: MediaType) {
    setCapturedMedia(prev => [...prev, { blob, type }])
  }

  function handleMediaDone() {
    setStep(2)
  }

  function selectAiSuggestion(suggestion: AISuggestion) {
    setCommonName(suggestion.common_name || '')
    setScientificName(suggestion.scientific_name || '')
    if (suggestion.category) setCategory(suggestion.category)
  }

  function selectSpecies(id: string, common: string, scientific: string | null) {
    setSelectedSpeciesId(id)
    setCommonName(common)
    setScientificName(scientific || '')
    setSpeciesSearch('')
  }

  async function handleSubmit() {
    if (!category || !user) return
    setSubmitting(true)
    setSubmitError(null)

    const sightingId = uuidv4()
    const now = new Date().toISOString()
    const lat = location?.latitude ?? 0
    const lng = location?.longitude ?? 0
    const accuracy = location?.accuracy ?? null

    const isOnline = navigator.onLine

    try {
      if (isOnline) {
        // Upload media
        const mediaRecords: { path: string; type: MediaType; mime: string }[] = []
        for (let i = 0; i < capturedMedia.length; i++) {
          const m = capturedMedia[i]!
          const { path } = await uploadMedia(user.id, sightingId, m.blob, m.type, i)
          mediaRecords.push({ path, type: m.type, mime: m.blob.type })
        }

        // Insert sighting
        const { error: insertError } = await (supabase.from('sightings') as any).insert({
          id: sightingId,
          user_id: user.id,
          species_id: selectedSpeciesId,
          category,
          common_name: commonName || null,
          scientific_name: scientificName || null,
          notes: notes || null,
          latitude: lat,
          longitude: lng,
          location_accuracy: accuracy,
          sighted_at: now,
          verification_status: aiSuggestions.length > 0 ? 'ai_suggested' : 'unverified',
          ai_confidence: aiSuggestions[0]?.confidence ?? null,
          ai_suggestions: aiSuggestions.length > 0 ? aiSuggestions : null,
          individual_count: individualCount,
        })
        if (insertError) throw insertError

        // Insert media records
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
        // Save offline
        await savePendingSighting({
          id: sightingId,
          category,
          common_name: commonName || null,
          scientific_name: scientificName || null,
          notes: notes || null,
          latitude: lat,
          longitude: lng,
          location_accuracy: accuracy,
          sighted_at: now,
          ai_suggestions: aiSuggestions.length > 0 ? aiSuggestions : null,
          ai_confidence: aiSuggestions[0]?.confidence ?? null,
          individual_count: individualCount,
          media: capturedMedia.map(m => ({
            blob: m.blob,
            type: m.type,
            mime_type: m.blob.type,
          })),
          created_at: now,
        })
      }

      navigate('/', { replace: true })
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save sighting')
    } finally {
      setSubmitting(false)
    }
  }

  function goBack() {
    if (step === 0) {
      navigate(-1)
    } else {
      setStep((step - 1) as Step)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Sighting</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                i <= step ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                i <= step ? 'text-emerald-700' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Category */}
      {step === 0 && <CategoryPicker onSelect={handleCategorySelect} />}

      {/* Step 2: Media */}
      {step === 1 && (
        <MediaCapture onMediaCapture={handleMediaCapture} onDone={handleMediaDone} />
      )}

      {/* Step 3: Details */}
      {step === 2 && (
        <div className="space-y-5">
          {/* GPS location */}
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4 text-emerald-600" />
              GPS Location
            </div>
            {geoLoading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Acquiring location...
              </div>
            )}
            {geoError && (
              <p className="mt-2 text-sm text-red-600">{geoError}</p>
            )}
            {location && (
              <p className="mt-1 text-sm font-mono text-gray-600">
                {formatCoordinates(location.latitude, location.longitude)}
                {location.accuracy && (
                  <span className="ml-2 text-xs text-gray-400">
                    (+-{location.accuracy.toFixed(0)}m)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* AI suggestions */}
          {(aiLoading || aiSuggestions.length > 0) && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                <Sparkles className="h-4 w-4" />
                AI Identification
              </div>
              {aiLoading ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-indigo-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing photo...
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectAiSuggestion(s)}
                      className="flex w-full items-center justify-between rounded-lg bg-white p-3 text-left ring-1 ring-indigo-100 transition hover:ring-indigo-300"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {s.common_name || 'Unknown'}
                        </p>
                        {s.scientific_name && (
                          <p className="text-xs italic text-gray-500">{s.scientific_name}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Species search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Species
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={speciesSearch}
                onChange={e => handleSpeciesSearch(e.target.value)}
                placeholder="Search species..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {speciesSearch.length >= 2 && species.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                {species.map(sp => (
                  <li key={sp.id}>
                    <button
                      type="button"
                      onClick={() => selectSpecies(sp.id, sp.common_name, sp.scientific_name)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{sp.common_name}</span>
                        {sp.scientific_name && (
                          <span className="ml-2 italic text-gray-500">{sp.scientific_name}</span>
                        )}
                      </div>
                      {selectedSpeciesId === sp.id && (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {commonName && (
              <p className="mt-1 text-xs text-emerald-600">
                Selected: {commonName}
                {scientificName && <span className="italic"> ({scientificName})</span>}
              </p>
            )}
          </div>

          {/* Common name (manual) */}
          <div>
            <label htmlFor="commonName" className="mb-1 block text-sm font-medium text-gray-700">
              Common Name
            </label>
            <input
              id="commonName"
              type="text"
              value={commonName}
              onChange={e => setCommonName(e.target.value)}
              placeholder="e.g., Indian Leopard"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Individual count */}
          <div>
            <label htmlFor="count" className="mb-1 block text-sm font-medium text-gray-700">
              Individual Count
            </label>
            <input
              id="count"
              type="number"
              min={1}
              value={individualCount}
              onChange={e => setIndividualCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Behavior, habitat details, weather..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Error */}
          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                {navigator.onLine ? 'Submit Sighting' : 'Save Offline'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
