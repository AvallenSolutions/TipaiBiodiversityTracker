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
  Leaf,
  Cat,
  Bird,
  Footprints,
  Bug,
  Flower2,
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

// ── Constants ──────────────────────────────────────────────────

const CATEGORIES: SightingCategory[] = [
  'mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace',
]
const VERIFICATION_STATUSES: VerificationStatus[] = [
  'unverified', 'ai_suggested', 'verified', 'rejected',
]

const categoryDarkBg: Record<SightingCategory, string> = {
  mammal:    'bg-gradient-to-br from-amber-950 via-amber-900 to-amber-800',
  bird:      'bg-gradient-to-br from-sky-950 via-sky-900 to-sky-800',
  reptile:   'bg-gradient-to-br from-lime-950 via-lime-900 to-lime-800',
  amphibian: 'bg-gradient-to-br from-teal-950 via-teal-900 to-teal-800',
  insect:    'bg-gradient-to-br from-orange-950 via-orange-900 to-orange-800',
  plant:     'bg-gradient-to-br from-tipai-900 via-tipai-800 to-tipai-700',
  fungi:     'bg-gradient-to-br from-purple-950 via-purple-900 to-purple-800',
  trace:     'bg-gradient-to-br from-stone-900 via-stone-800 to-stone-700',
}

const statusColors: Record<VerificationStatus, string> = {
  unverified:   'bg-gray-100 text-gray-600',
  ai_suggested: 'bg-tipai-100 text-tipai-700',
  verified:     'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-700',
}

function PlaceholderIcon({ category }: { category: SightingCategory }) {
  const cls = 'h-20 w-20 text-white opacity-20 stroke-[1]'
  switch (category) {
    case 'mammal':    return <Cat        className={cls} />
    case 'bird':      return <Bird       className={cls} />
    case 'trace':     return <Footprints className={cls} />
    case 'insect':    return <Bug        className={cls} />
    case 'fungi':     return <Flower2    className={cls} />
    default:          return <Leaf       className={cls} />
  }
}

// ── Component ──────────────────────────────────────────────────

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
  const [imgErr, setImgErr] = useState(false)

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

  useEffect(() => { fetchSighting() }, [fetchSighting])

  // Reset img error when gallery index changes
  useEffect(() => { setImgErr(false) }, [galleryIndex])

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
      if (editCategory !== sighting.category)
        changes.category = { old: sighting.category, new: editCategory }
      if (editCommonName !== (sighting.common_name || ''))
        changes.common_name = { old: sighting.common_name, new: editCommonName || null }
      if (editNotes !== (sighting.notes || ''))
        changes.notes = { old: sighting.notes, new: editNotes || null }
      if (editVerification !== sighting.verification_status)
        changes.verification_status = { old: sighting.verification_status, new: editVerification }

      if (Object.keys(changes).length === 0) { setEditing(false); return }

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

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-tipai-600" />
      </div>
    )
  }

  if (error && !sighting) {
    return (
      <div className="p-4 space-y-4">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      </div>
    )
  }

  if (!sighting) return null

  const mediaItems = sighting.media || []
  const currentMedia = mediaItems[galleryIndex]
  const heroUrl = currentMedia && !imgErr ? getMediaUrl(currentMedia.storage_path) : null

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-tipai-stone-50">

      {/* ── Hero photo ─────────────────────────────────────── */}
      <div className="relative h-80 w-full overflow-hidden bg-black">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={sighting.common_name || 'Sighting'}
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${categoryDarkBg[sighting.category]}`}>
            <PlaceholderIcon category={sighting.category} />
          </div>
        )}

        {/* Gradient scrims */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />

        {/* Back button */}
        <Link
          to="/"
          className="absolute left-4 top-4 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/60"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Edit / Delete */}
        {canEdit && !editing && (
          <div className="absolute right-4 top-4 flex gap-2">
            <button
              onClick={startEditing}
              className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Edit"
            >
              <Pencil className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-red-600/80"
              aria-label="Delete"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* Gallery arrows */}
        {mediaItems.length > 1 && (
          <>
            <button
              onClick={() => setGalleryIndex(i => (i - 1 + mediaItems.length) % mediaItems.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setGalleryIndex(i => (i + 1) % mediaItems.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-0.5 text-xs text-white">
              {galleryIndex + 1} / {mediaItems.length}
            </div>
          </>
        )}
      </div>

      {/* ── Content card — overlaps photo ──────────────────── */}
      <div className="-mt-5 relative z-10 rounded-t-3xl bg-tipai-stone-50 px-5 pb-10 pt-6 space-y-7">

        {/* Species identity */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-tipai-500">
            {sighting.category}
          </p>
          <h1 className="mt-0.5 font-heading text-[2.4rem] font-semibold leading-tight text-tipai-900">
            {sighting.common_name || 'Unidentified Species'}
          </h1>
          {sighting.scientific_name && (
            <p className="mt-0.5 text-base italic text-gray-500">{sighting.scientific_name}</p>
          )}
          <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${statusColors[sighting.verification_status]}`}>
            {sighting.verification_status.replace('_', ' ')}
          </span>
        </div>

        {/* Inline error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Permanently delete this sighting?
            </p>
            <p className="mt-0.5 text-xs text-red-500">This action cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-tipai-500">
              Edit Sighting
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</label>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value as SightingCategory)}
                className="w-full rounded-xl border border-gray-200 bg-tipai-stone-50 px-3 py-2.5 text-sm focus:border-tipai-400 focus:outline-none focus:ring-1 focus:ring-tipai-400"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wide">Common Name</label>
              <input
                type="text"
                value={editCommonName}
                onChange={e => setEditCommonName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-tipai-stone-50 px-3 py-2.5 text-sm focus:border-tipai-400 focus:outline-none focus:ring-1 focus:ring-tipai-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-tipai-stone-50 px-3 py-2.5 text-sm focus:border-tipai-400 focus:outline-none focus:ring-1 focus:ring-tipai-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wide">Verification Status</label>
              <select
                value={editVerification}
                onChange={e => setEditVerification(e.target.value as VerificationStatus)}
                className="w-full rounded-xl border border-gray-200 bg-tipai-stone-50 px-3 py-2.5 text-sm focus:border-tipai-400 focus:outline-none focus:ring-1 focus:ring-tipai-400"
              >
                {VERIFICATION_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-tipai-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tipai-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Metadata ───────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <MetaRow
            icon={<Calendar className="h-4 w-4 text-tipai-400" />}
            label="Date"
            value={format(new Date(sighting.sighted_at), 'MMMM d, yyyy · h:mm a')}
          />
          <div className="mx-5 h-px bg-gray-50" />
          <MetaRow
            icon={<MapPin className="h-4 w-4 text-tipai-400" />}
            label="Location"
            value={formatCoordinates(sighting.latitude, sighting.longitude)}
          />
          {sighting.location_accuracy && (
            <>
              <div className="mx-5 h-px bg-gray-50" />
              <MetaRow
                icon={<MapPin className="h-4 w-4 text-tipai-300" />}
                label="Accuracy"
                value={`±${sighting.location_accuracy.toFixed(0)} m`}
              />
            </>
          )}
          <div className="mx-5 h-px bg-gray-50" />
          <MetaRow
            icon={<User className="h-4 w-4 text-tipai-400" />}
            label="Observer"
            value={sighting.profile?.display_name || sighting.profile?.email || 'Unknown'}
          />
          {sighting.individual_count && sighting.individual_count > 1 && (
            <>
              <div className="mx-5 h-px bg-gray-50" />
              <MetaRow
                icon={<Hash className="h-4 w-4 text-tipai-400" />}
                label="Count"
                value={String(sighting.individual_count)}
              />
            </>
          )}
        </div>

        {/* Notes */}
        {sighting.notes && (
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
              Field Notes
            </p>
            <p className="text-[0.9rem] leading-relaxed text-gray-700 whitespace-pre-wrap">
              {sighting.notes}
            </p>
          </div>
        )}

        {/* ── AI identification ──────────────────────────────── */}
        {sighting.ai_suggestions && sighting.ai_suggestions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
              AI Analysis
            </p>
            <div className="rounded-2xl bg-tipai-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-tipai-700">
                <Sparkles className="h-4 w-4" />
                Species Identification
              </div>
              <div className="space-y-3">
                {sighting.ai_suggestions.map((s, i) => (
                  <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-tipai-100">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-heading text-base font-semibold text-gray-900">
                          {s.common_name || 'Unknown'}
                        </p>
                        {s.scientific_name && (
                          <p className="text-xs italic text-gray-500">{s.scientific_name}</p>
                        )}
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-tipai-100 px-2.5 py-0.5 text-xs font-semibold text-tipai-700">
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-tipai-100">
                      <div
                        className="h-1.5 rounded-full bg-tipai-500"
                        style={{ width: `${s.confidence * 100}%` }}
                      />
                    </div>
                    {s.description && (
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">{s.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Edit history ───────────────────────────────────── */}
        {edits.length > 0 && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-tipai-500">
              Edit History
            </p>
            <div className="space-y-2">
              {edits.map(edit => (
                <div key={edit.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-100 text-sm">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(edit.created_at), 'MMM d, yyyy · h:mm a')}
                    <span className="text-gray-300">by</span>
                    <span className="font-semibold text-gray-600">
                      {edit.editor?.display_name || edit.editor?.email || 'Unknown'}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-gray-500">
                    {Object.entries(edit.changes).map(([field, change]) => (
                      <li key={field}>
                        <span className="font-medium text-gray-700">{field.replace('_', ' ')}:</span>{' '}
                        <span className="text-red-400 line-through">{String(change.old ?? '—')}</span>{' '}
                        <span className="text-tipai-600">→ {String(change.new ?? '—')}</span>
                      </li>
                    ))}
                  </ul>
                  {edit.edit_reason && (
                    <p className="mt-1.5 text-xs italic text-gray-400">"{edit.edit_reason}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {icon}
      <span className="w-20 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}
