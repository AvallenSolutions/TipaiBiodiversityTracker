import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sighting } from '../types/sighting'
import { CategoryType } from '../types/database'
import { formatCoordinates } from '../utils/geolocation'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Trash2,
  Save,
  Loader,
  Volume2
} from 'lucide-react'
import { format } from 'date-fns'

const categories: CategoryType[] = ['mammal', 'bird', 'lizard', 'insect', 'plant', 'trace', 'fungi']

export default function SightingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [sighting, setSighting] = useState<Sighting | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editCategory, setEditCategory] = useState<CategoryType>('mammal')
  const [editSpecies, setEditSpecies] = useState('')
  const [editCommonName, setEditCommonName] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    loadSighting()
  }, [id])

  async function loadSighting() {
    if (!id) return
    try {
      const { data, error } = await supabase
        .from('sightings')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      const sightingData = data as unknown as Sighting
      setSighting(sightingData)
      setEditCategory(sightingData.category)
      setEditSpecies(sightingData.species_name || '')
      setEditCommonName(sightingData.common_name || '')
      setEditNotes(sightingData.notes || '')
    } catch (error) {
      console.error('Error loading sighting:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!sighting) return
    setSaving(true)
    try {
      const { error } = await (supabase
        .from('sightings') as any)
        .update({
          category: editCategory,
          species_name: editSpecies || null,
          common_name: editCommonName || null,
          notes: editNotes || null
        })
        .eq('id', sighting.id)

      if (error) throw error

      setSighting({
        ...sighting,
        category: editCategory,
        species_name: editSpecies || null,
        common_name: editCommonName || null,
        notes: editNotes || null
      })
      setEditing(false)
    } catch (error: any) {
      alert(`Error saving: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!sighting) return
    if (!confirm('Are you sure you want to delete this sighting? This cannot be undone.')) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('sightings')
        .delete()
        .eq('id', sighting.id)

      if (error) throw error
      navigate('/dashboard')
    } catch (error: any) {
      alert(`Error deleting: ${error.message}`)
      setDeleting(false)
    }
  }

  const canEdit = sighting && (
    profile?.user_role === 'naturalist' || profile?.id === sighting.user_id
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tipai-green-50 to-tipai-green-100">
        <div className="text-center">
          <Loader className="w-12 h-12 text-tipai-green-700 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading sighting...</p>
        </div>
      </div>
    )
  }

  if (!sighting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tipai-green-50 to-tipai-green-100">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Sighting not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-tipai-green-700 hover:text-tipai-green-900"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const aiData = sighting.ai_identification as any

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100">
      {/* Header */}
      <div className="bg-tipai-green-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-tipai-green-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Photo */}
          {sighting.photo_url && (
            <img
              src={sighting.photo_url}
              alt="Sighting"
              className="w-full max-h-96 object-cover"
            />
          )}

          <div className="p-6 space-y-6">
            {/* Title & Category */}
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CategoryType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Common Name</label>
                  <input
                    type="text"
                    value={editCommonName}
                    onChange={(e) => setEditCommonName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                    placeholder="Common name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Species Name</label>
                  <input
                    type="text"
                    value={editSpecies}
                    onChange={(e) => setEditSpecies(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent"
                    placeholder="Scientific name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tipai-green-500 focus:border-transparent resize-none"
                    placeholder="Add notes..."
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="px-4 py-1.5 bg-tipai-green-100 text-tipai-green-800 font-medium rounded-full capitalize">
                    {sighting.category}
                  </span>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(sighting.sighted_at), 'MMMM d, yyyy h:mm a')}
                  </div>
                </div>

                {sighting.common_name && (
                  <h2 className="text-2xl font-bold text-gray-900">{sighting.common_name}</h2>
                )}
                {sighting.species_name && (
                  <p className="text-lg text-gray-600 italic">{sighting.species_name}</p>
                )}

                {sighting.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
                    <p className="text-gray-700">{sighting.notes}</p>
                  </div>
                )}
              </>
            )}

            {/* Location */}
            <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-4">
              <MapPin className="w-5 h-5 text-tipai-green-600 mt-0.5" />
              <div>
                <p className="font-mono text-sm text-gray-700">
                  {formatCoordinates(sighting.latitude, sighting.longitude)}
                </p>
                {sighting.location_accuracy && (
                  <p className="text-xs text-gray-500">
                    Accuracy: ±{Math.round(sighting.location_accuracy)}m
                  </p>
                )}
              </div>
            </div>

            {/* Audio */}
            {sighting.audio_url && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-medium text-gray-500">Audio Recording</h3>
                </div>
                <audio src={sighting.audio_url} controls className="w-full" />
              </div>
            )}

            {/* AI Identification */}
            {aiData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">AI Identification</h3>
                {aiData.common_name && (
                  <p className="text-blue-900 font-semibold">{aiData.common_name}</p>
                )}
                {aiData.species && (
                  <p className="text-blue-700 text-sm italic">{aiData.species}</p>
                )}
                {aiData.confidence !== undefined && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm text-blue-700">
                      <span>Confidence</span>
                      <span>{aiData.confidence}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${aiData.confidence}%` }}
                      />
                    </div>
                  </div>
                )}
                {aiData.description && (
                  <p className="text-blue-700 text-sm mt-2">{aiData.description}</p>
                )}
              </div>
            )}

            {/* Actions */}
            {canEdit && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 bg-tipai-green-700 text-white py-3 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setEditCategory(sighting.category)
                        setEditSpecies(sighting.species_name || '')
                        setEditCommonName(sighting.common_name || '')
                        setEditNotes(sighting.notes || '')
                      }}
                      className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="flex-1 bg-tipai-green-700 text-white py-3 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors"
                    >
                      Edit Sighting
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleting ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
