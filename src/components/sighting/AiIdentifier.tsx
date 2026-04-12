import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, XCircle } from 'lucide-react'
import type { AISuggestion } from '@/types'

interface AiIdentifierProps {
  suggestions: AISuggestion[] | null
  loading: boolean
  onSelect: (suggestion: AISuggestion) => void
}

function confidenceColor(value: number): string {
  if (value >= 0.7) return 'bg-emerald-500'
  if (value >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}

function confidenceLabel(value: number): string {
  if (value >= 0.7) return 'High'
  if (value >= 0.4) return 'Medium'
  return 'Low'
}

function playChime() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
    osc.onended = () => ctx.close()
  } catch {
    // Web Audio not available — silently skip
  }
}

export default function AiIdentifier({ suggestions, loading, onSelect }: AiIdentifierProps) {
  // Track which suggestion IDs have been "animated in" to avoid re-triggering
  const chimePlayedRef = useRef(false)
  // Animated bar widths: indexed by suggestion position
  const [barWidths, setBarWidths] = useState<number[]>([])

  // When suggestions arrive, trigger bar animation and chime
  useEffect(() => {
    if (!suggestions || suggestions.length === 0) {
      setBarWidths([])
      chimePlayedRef.current = false
      return
    }

    // Start bars at 0, then animate to target after one frame
    setBarWidths(suggestions.map(() => 0))
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBarWidths(suggestions.map(s => Math.round(s.confidence * 100)))
      })
    })

    // Play chime if top suggestion is high confidence
    if (!chimePlayedRef.current && suggestions[0] && suggestions[0].confidence >= 0.7) {
      chimePlayedRef.current = true
      playChime()
    }

    return () => cancelAnimationFrame(frame)
  }, [suggestions])

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-tipai-600" />
        <p className="text-sm text-gray-500">Identifying species with AI...</p>
      </div>
    )
  }

  // ─── No suggestions yet ────────────────────────────────────
  if (!suggestions) return null

  // ─── Empty suggestions ─────────────────────────────────────
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <XCircle className="h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-500">
          Could not identify any species. You can still add details manually.
        </p>
      </div>
    )
  }

  // ─── Suggestion cards ──────────────────────────────────────
  const displayedSuggestions = suggestions.slice(0, 3)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-tipai-600" />
        <h2 className="font-heading text-xl font-semibold text-gray-800">AI Suggestions</h2>
      </div>

      <div className="space-y-3">
        {displayedSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="animate-slide-up-fade w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-tipai-300 hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-tipai-400"
            style={{ animationDelay: `${idx * 180}ms` }}
          >
            {/* Name row */}
            <div className="mb-1">
              <p className="font-heading text-lg font-semibold text-gray-800">
                {suggestion.common_name || 'Unknown species'}
              </p>
              {suggestion.scientific_name && (
                <p className="text-sm italic text-gray-500">
                  {suggestion.scientific_name}
                </p>
              )}
            </div>

            {/* Confidence bar */}
            <div className="mb-2 mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Confidence</span>
                <span className="font-medium">
                  {Math.round(suggestion.confidence * 100)}% &middot; {confidenceLabel(suggestion.confidence)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${confidenceColor(suggestion.confidence)}`}
                  style={{
                    width: `${barWidths[idx] ?? 0}%`,
                    transition: `width 700ms cubic-bezier(0.4, 0, 0.2, 1) ${idx * 180 + 300}ms`,
                  }}
                />
              </div>
            </div>

            {/* Description */}
            {suggestion.description && (
              <p className="text-sm leading-relaxed text-gray-600 line-clamp-2">
                {suggestion.description}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* None of these */}
      <button
        type="button"
        onClick={() =>
          onSelect({
            species: null,
            common_name: null,
            scientific_name: null,
            confidence: 0,
            description: null,
          })
        }
        className="w-full rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50 active:scale-[0.99]"
      >
        None of these
      </button>
    </div>
  )
}
