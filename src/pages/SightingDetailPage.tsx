import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  MapPin,
  Calendar,
  User,
  Hash,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import { formatCoordinates } from '@/hooks/useGeolocation'
import type {
  Sighting,
  SightingEdit,
  SightingCategory,
  VerificationStatus,
} from '@/types'

const CATEGORIES: SightingCategory[] = [
  'mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace',
]
const VERIFICATION_STATUSES: VerificationStatus[] = [
  'unverified', 'ai_suggested', 'verified', 'rejected',
]
const categoryColors: Record<SightingCategory, string> = {
  mammal: 'bg-amber-100 text-amber-700',
  bird: 'bg-sky-100 text-sky-700',
  reptile: 'bg-lime-100 text-lime-700',
  amphibian: 'bg-teal-100 text-teal-700',
  insect: 'bg-orange-100 text-orange-700',
  plant: 'bg-green-100 text-green-700',
  fungi: 'bg-purple-100 text-purple-700',
  trace: 'bg-stone-100 text-stone-700',
}
const statusColors: Record<VerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  ai_suggested: 'bg-indigo-100 text-indigo-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function SightingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [sighting, setSighting] = useState<Sighting | null>(null)
  const [edits, setEdits] = useState<SightingEdit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gallery
  const [galleryIndex, setGalleryIndex] = useState(0)

  // Editing
  const [editing, setEditing] = useState(false)
  const [editCategory, setEditCategory] = useState<SightingCategory>('mammal')
  const [editCommonName, setEditCommonName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editVerification, setEditVerification] = useState<VerificationStatus>('unverified')
  const [saving, setSaving] = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit =
    profile &&
    sighting &&
    (sighting.user_id === user?.id ||
      profile.role === 'naturalist' ||
      profile.role === 'admin')

  const fetchSighting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await (supabase.from('sightings') as any)
        .select('*, sighting_media(*), profile:profiles!sightings_user_id_fkey(*)')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr
      setSighting(data as Sighting)

      // Fetch edit history
      const { data: editData } = await (supabase.from('sighting_edits') as any)
        .select('*, editor:profiles!sighting_edits_edited_by_fkey(*)')
        .eq('sighting_id', id)
        .order('created_at', { ascending: false })
      setEdits((editData || []) as SightingEdit[])
    } catch (err: any) {
      setError(err.message || 'Failed to load sighting')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchSighting()
  }, [fetchSighting])

  function startEditing() {
    if (!sighting) return
    setEditCategory(sighting.category)
    setEditCommonName(sighting.common_name || '')
    setEditNotes(sighting.notes || '')
    setEditVerification(sighting.verification_status)
    setEditing(true)
  }

  async function saveEdit() {
    if (!sighting || !user) return
    setSaving(true)
    try {
      const changes: Record<string, { old: unknown; new: unknown }> = {}
      if (editCategory !== sighting.category) {
        changes.category = { old: sighting.category, new: editCategory }
      }
      if (editCommonName !== (sighting.common_name || '')) {
        changes.common_name = { old: sighting.common_name, new: editCommonName || null }
      }
      if (editNotes !== (sighting.notes || '')) {
        changes.notes = { old: sighting.notes, new: editNotes || null }
      }
      if (editVerification !== sighting.verification_status) {
        changes.verification_status = {
          old: sighting.verification_status,
          new: editVerification,
        }
      }

      if (Object.keys(changes).length === 0) {
        setEditing(false)
        return
      }

      const { error: updateErr } = await (supabase.from('sightings') as any)
        .update({
          category: editCategory,
          common_name: editCommonName || null,
          notes: editNotes || null,
          verification_status: editVerification,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sighting.id)
      if (updateErr) throw updateErr

      // Record edit
      await (supabase.from('sighting_edits') as any).insert({
        sighting_id: sighting.id,
        edited_by: user.id,
        changes,
      })

      setEditing(false)
      await fetchSighting()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!sighting) return
    setDeleting(true)
    try {
      const { error: delErr } = await (supabase.from('sightings') as any)
        .delete()
        .eq('id', sighting.id)
      if (delErr) throw delErr
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  // Error
  if (error && !sighting) {
    return (
      <div className="space-y-4">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      </div>
    )
  }

  if (!sighting) return null

  const mediaItems = sighting.media || []
  const currentMedia = mediaItems[galleryIndex]

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Photo gallery */}
      {mediaItems.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <img
            src={getMediaUrl(currentMedia!.storage_path)}
            alt={sighting.common_name || 'Sighting photo'}
            className="mx-auto max-h-80 object-contain"
          />
          {mediaItems.length > 1 && (
            <>
              <button
                onClick={() =>
                  setGalleryIndex(i => (i - 1 + mediaItems.length) % mediaItems.length)
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() =>
                  setGalleryIndex(i => (i + 1) % mediaItems.length)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                {galleryIndex + 1} / {mediaItems.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Header + actions */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${categoryColors[sighting.category]}`}
            >
              {sighting.category}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[sighting.verification_status]}`}
            >
              {sighting.verification_status.replace('_', ' ')}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-900">
            {sighting.common_name || 'Unidentified'}
          </h1>
          {sighting.scientific_name && (
            <p className="text-sm italic text-gray-500">{sighting.scientific_name}</p>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <button
              onClick={startEditing}
              className="rounded-lg bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Are you sure you want to delete this sighting?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Editing form */}
      {editing && (
        <div className="space-y-4 rounded-xl bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-700">Edit Sighting</h3>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value as SightingCategory)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Common Name</label>
            <input
              type="text"
              value={editCommonName}
              onChange={e => setEditCommonName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea
              rows={3}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Verification Status
            </label>
            <select
              value={editVerification}
              onChange={e => setEditVerification(e.target.value as VerificationStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {VERIFICATION_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail fields */}
      <div className="space-y-3">
        <DetailRow
          icon={<Calendar className="h-4 w-4 text-gray-400" />}
          label="Date"
          value={format(new Date(sighting.sighted_at), 'MMMM d, yyyy h:mm a')}
        />
        <DetailRow
          icon={<MapPin className="h-4 w-4 text-gray-400" />}
          label="Location"
          value={formatCoordinates(sighting.latitude, sighting.longitude)}
        />
        {sighting.location_accuracy && (
          <DetailRow
            icon={<MapPin className="h-4 w-4 text-gray-400" />}
            label="Accuracy"
            value={`+-${sighting.location_accuracy.toFixed(0)} meters`}
          />
        )}
        <DetailRow
          icon={<User className="h-4 w-4 text-gray-400" />}
          label="Observer"
          value={sighting.profile?.display_name || sighting.profile?.email || 'Unknown'}
        />
        {sighting.individual_count && (
          <DetailRow
            icon={<Hash className="h-4 w-4 text-gray-400" />}
            label="Count"
            value={String(sighting.individual_count)}
          />
        )}
        {sighting.notes && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sighting.notes}</p>
          </div>
        )}
      </div>

      {/* AI identification info */}
      {sighting.ai_suggestions && sighting.ai_suggestions.length > 0 && (
        <div className="rounded-xl bg-indigo-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Sparkles className="h-4 w-4" />
            AI Identification
          </div>
          <div className="mt-3 space-y-3">
            {sighting.ai_suggestions.map((s, i) => (
              <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-indigo-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {s.common_name || 'Unknown'}
                    </p>
                    {s.scientific_name && (
                      <p className="text-xs italic text-gray-500">{s.scientific_name}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-indigo-600">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Confidence bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${s.confidence * 100}%` }}
                  />
                </div>
                {s.description && (
                  <p className="mt-2 text-xs text-gray-600">{s.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit history */}
      {edits.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Edit History</h3>
          <div className="space-y-2">
            {edits.map(edit => (
              <div
                key={edit.id}
                className="rounded-lg bg-gray-50 p-3 text-sm"
              >
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{format(new Date(edit.created_at), 'MMM d, yyyy h:mm a')}</span>
                  <span className="text-gray-400">by</span>
                  <span className="font-medium text-gray-700">
                    {edit.editor?.display_name || edit.editor?.email || 'Unknown'}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                  {Object.entries(edit.changes).map(([field, change]) => (
                    <li key={field}>
                      <span className="font-medium">{field.replace('_', ' ')}:</span>{' '}
                      <span className="text-red-500 line-through">{String(change.old ?? 'none')}</span>{' '}
                      <span className="text-emerald-600">{String(change.new ?? 'none')}</span>
                    </li>
                  ))}
                </ul>
                {edit.edit_reason && (
                  <p className="mt-1 text-xs italic text-gray-500">
                    Reason: {edit.edit_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {icon}
      <span className="w-20 flex-shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}
