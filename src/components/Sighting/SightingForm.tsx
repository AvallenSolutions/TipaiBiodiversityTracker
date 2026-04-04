import { useState, useEffect, useMemo } from 'react'
import { MapPin, Loader, Check } from 'lucide-react'
import { CategoryType } from '../../types/database'
import { getCurrentLocation, formatCoordinates } from '../../utils/geolocation'
import { identifySpecies } from '../../utils/gemini'
import { AIIdentification, LocationData } from '../../types/sighting'

interface SightingFormProps {
  category: CategoryType
  photoBlob: Blob | null
  audioBlob: Blob | null
  cachedAIIdentification: AIIdentification | null
  onAIIdentification: (ai: AIIdentification) => void
  onSubmit: (data: {
    notes: string
    location: LocationData
    aiIdentification: AIIdentification | null
  }) => void
  onBack: () => void
}

export default function SightingForm({
  category,
  photoBlob,
  audioBlob,
  cachedAIIdentification,
  onAIIdentification,
  onSubmit,
  onBack
}: SightingFormProps) {
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loadingLocation, setLoadingLocation] = useState(true)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiIdentification, setAiIdentification] = useState<AIIdentification | null>(cachedAIIdentification)
  const [submitting, setSubmitting] = useState(false)

  const photoPreviewUrl = useMemo(() => {
    if (!photoBlob) return null
    return URL.createObjectURL(photoBlob)
  }, [photoBlob])

  const audioPreviewUrl = useMemo(() => {
    if (!audioBlob) return null
    return URL.createObjectURL(audioBlob)
  }, [audioBlob])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [photoPreviewUrl, audioPreviewUrl])

  useEffect(() => {
    loadLocation()
    if (photoBlob && import.meta.env.VITE_GEMINI_API_KEY && !cachedAIIdentification) {
      identifyWithAI()
    }
  }, [])

  async function loadLocation() {
    try {
      const loc = await getCurrentLocation()
      setLocation(loc)
    } catch (error: any) {
      alert(`Could not get location: ${error.message}`)
    } finally {
      setLoadingLocation(false)
    }
  }

  async function identifyWithAI() {
    if (!photoBlob) return

    setLoadingAI(true)
    try {
      const identification = await identifySpecies(photoBlob, category)
      setAiIdentification(identification)
      onAIIdentification(identification)
    } catch (error) {
      console.error('AI identification failed:', error)
    } finally {
      setLoadingAI(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!location) {
      alert('Please wait for location to be determined')
      return
    }

    setSubmitting(true)
    onSubmit({
      notes,
      location,
      aiIdentification
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <button
          onClick={onBack}
          className="mb-4 text-tipai-green-700 hover:text-tipai-green-900"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-tipai-green-900 text-center mb-2">
          Sighting Details
        </h1>
        <p className="text-center text-gray-600 mb-8 capitalize">
          {category}
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {/* AI Identification */}
          {loadingAI && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-blue-800 font-medium">Identifying species with AI...</span>
              </div>
            </div>
          )}

          {aiIdentification && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-semibold">
                    {aiIdentification.common_name || 'Species identified'}
                  </p>
                  {aiIdentification.species && (
                    <p className="text-green-700 text-sm italic">
                      {aiIdentification.species}
                    </p>
                  )}
                  {aiIdentification.confidence !== undefined && (
                    <p className="text-green-600 text-sm">
                      Confidence: {aiIdentification.confidence}%
                    </p>
                  )}
                  {aiIdentification.description && (
                    <p className="text-gray-700 text-sm mt-2">
                      {aiIdentification.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            {loadingLocation ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Getting location...</span>
              </div>
            ) : location ? (
              <div className="flex items-start gap-2 text-gray-700 bg-gray-50 rounded-lg p-3">
                <MapPin className="w-5 h-5 text-tipai-green-600 mt-0.5" />
                <div>
                  <p className="font-mono text-sm">
                    {formatCoordinates(location.latitude, location.longitude)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Accuracy: ±{Math.round(location.accuracy)}m
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-red-600">Location unavailable</p>
            )}
          </div>

          {/* Preview Media */}
          {photoPreviewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Captured Photo
              </label>
              <img
                src={photoPreviewUrl}
                alt="Sighting"
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          )}

          {audioPreviewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio Recording
              </label>
              <audio
                src={audioPreviewUrl}
                controls
                className="w-full"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent resize-none"
              placeholder="Add any additional details about this sighting..."
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!location || submitting}
            className="w-full bg-tipai-green-700 text-white py-4 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Saving Sighting...
              </>
            ) : (
              'Save Sighting'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
