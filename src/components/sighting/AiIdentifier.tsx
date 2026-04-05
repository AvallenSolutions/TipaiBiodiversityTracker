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

export default function AiIdentifier({ suggestions, loading, onSelect }: AiIdentifierProps) {
  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
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
  const pct = (v: number) => Math.round(v * 100)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-gray-800">AI Suggestions</h2>
      </div>

      <div className="space-y-3">
        {displayedSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {/* Name row */}
            <div className="mb-1">
              <p className="text-base font-semibold text-gray-800">
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
                  {pct(suggestion.confidence)}% &middot; {confidenceLabel(suggestion.confidence)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confidenceColor(suggestion.confidence)}`}
                  style={{ width: `${pct(suggestion.confidence)}%` }}
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
