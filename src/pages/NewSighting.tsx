import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CategorySelection from '../components/Sighting/CategorySelection'
import MediaCapture from '../components/Sighting/MediaCapture'
import SightingForm from '../components/Sighting/SightingForm'
import { CategoryType } from '../types/database'
import { saveSightingOnline, saveSightingOffline } from '../services/syncService'
import { LocationData, AIIdentification } from '../types/sighting'

type Step = 'category' | 'media' | 'details'

export default function NewSighting() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('category')
  const [category, setCategory] = useState<CategoryType | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  function handleCategorySelect(selectedCategory: CategoryType) {
    setCategory(selectedCategory)
    setStep('media')
  }

  function handleMediaComplete() {
    setStep('details')
  }

  async function handleSubmit(data: {
    notes: string
    location: LocationData
    aiIdentification: AIIdentification | null
  }) {
    if (!category) return

    const sightedAt = new Date().toISOString()

    try {
      if (navigator.onLine) {
        await saveSightingOnline(
          category,
          data.location.latitude,
          data.location.longitude,
          data.location.accuracy,
          photoBlob,
          audioBlob,
          data.notes || null,
          data.aiIdentification,
          sightedAt
        )
        alert('Sighting saved successfully!')
      } else {
        await saveSightingOffline({
          category,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          location_accuracy: data.location.accuracy,
          photo_blob: photoBlob,
          audio_blob: audioBlob,
          notes: data.notes || null,
          sighted_at: sightedAt
        })
        alert('Sighting saved offline. It will sync when you are back online.')
      }

      navigate('/dashboard')
    } catch (error: any) {
      console.error('Error saving sighting:', error)
      alert(`Error saving sighting: ${error.message}`)
    }
  }

  if (step === 'category') {
    return <CategorySelection onSelect={handleCategorySelect} />
  }

  if (step === 'media' && category) {
    return (
      <MediaCapture
        onPhotoCapture={setPhotoBlob}
        onAudioCapture={setAudioBlob}
        onSkip={handleMediaComplete}
        initialPhoto={photoBlob}
        initialAudio={audioBlob}
      />
    )
  }

  if (step === 'details' && category) {
    return (
      <SightingForm
        category={category}
        photoBlob={photoBlob}
        audioBlob={audioBlob}
        onSubmit={handleSubmit}
        onBack={() => setStep('media')}
      />
    )
  }

  return null
}
