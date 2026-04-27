import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { DS } from '../../lib/ledger-design'
import { supabase } from '../../lib/supabase'
import { uploadSpeciesImage } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import type { Species, SightingCategory } from '../../types'
import { Mono } from './shared'
import { MonoIcon } from '../logger/shared'

const CATEGORIES: SightingCategory[] = [
  'mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace',
]

type NativeFlag = 'unknown' | 'native' | 'non_native'

function flagFromBool(v: boolean | null | undefined): NativeFlag {
  if (v === true) return 'native'
  if (v === false) return 'non_native'
  return 'unknown'
}
function flagToBool(f: NativeFlag): boolean | null {
  if (f === 'native') return true
  if (f === 'non_native') return false
  return null
}

export function SpeciesEditorSheet({
  species, onClose, onSaved,
}: {
  species: Species | null   // null = creating a new species
  onClose: () => void
  onSaved: (saved: Species) => void
}) {
  const { user } = useAuth()
  const isNew = species === null

  const [common, setCommon] = useState(species?.common_name ?? '')
  const [scientific, setScientific] = useState(species?.scientific_name ?? '')
  const [category, setCategory] = useState<SightingCategory>(species?.category ?? 'mammal')
  const [subcategory, setSubcategory] = useState(species?.subcategory ?? '')
  const [family, setFamily] = useState(species?.family ?? '')
  const [description, setDescription] = useState(species?.description ?? '')
  const [habitat, setHabitat] = useState(species?.habitat ?? '')
  const [nativeFlag, setNativeFlag] = useState<NativeFlag>(flagFromBool(species?.is_native))
  const [isNotable, setIsNotable] = useState<boolean>(!!species?.is_notable)

  const [coverUrl, setCoverUrl] = useState<string | null>(species?.reference_image_url ?? null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>(species?.gallery_image_urls ?? [])

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // For new species we don't have an id until first save, but uploads need
  // *some* path segment for storage. Generate a stable temp id so the user
  // can stage a cover and gallery photos before the row is inserted.
  const targetIdRef = useRef<string>(species?.id ?? uuidv4())

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadSpeciesImage(user.id, targetIdRef.current, file)
      setCoverUrl(url)
    } catch (err: any) {
      setError(err?.message || 'Failed to upload cover image')
    } finally {
      setUploading(false)
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !user) return
    setError(null)
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const { url } = await uploadSpeciesImage(user.id, targetIdRef.current, file)
        uploaded.push(url)
      }
      setGalleryUrls(prev => [...prev, ...uploaded])
    } catch (err: any) {
      setError(err?.message || 'Failed to upload gallery image')
    } finally {
      setUploading(false)
    }
  }

  function removeGallery(url: string) {
    setGalleryUrls(prev => prev.filter(u => u !== url))
  }

  function makeCover(url: string) {
    // Promote a gallery image to cover; the previous cover (if any) drops
    // back into the gallery so nothing is lost.
    setGalleryUrls(prev => {
      const without = prev.filter(u => u !== url)
      return coverUrl ? [coverUrl, ...without] : without
    })
    setCoverUrl(url)
  }

  function clearCover() {
    setCoverUrl(null)
  }

  async function handleSubmit() {
    if (!common.trim()) {
      setError('Common name is required')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        common_name: common.trim(),
        scientific_name: scientific.trim() || null,
        category,
        subcategory: subcategory.trim() || null,
        family: family.trim() || null,
        description: description.trim() || null,
        habitat: habitat.trim() || null,
        is_native: flagToBool(nativeFlag),
        is_notable: isNotable,
        reference_image_url: coverUrl,
        gallery_image_urls: galleryUrls,
      }

      if (isNew) {
        const { data, error: insertError } = await (supabase.from('species') as any)
          .insert({ id: targetIdRef.current, ...payload })
          .select('*')
          .single()
        if (insertError) throw insertError
        onSaved(data as Species)
      } else {
        const { data, error: updateError } = await (supabase.from('species') as any)
          .update(payload)
          .eq('id', species!.id)
          .select('*')
          .single()
        if (updateError) throw updateError
        onSaved(data as Species)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save species')
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    border: `0.5px solid ${DS.inkFaint}`, background: DS.bone,
    fontFamily: DS.serif, fontSize: 16, fontWeight: 400,
    color: DS.ink, outline: 'none',
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? 'Add new species' : `Edit ${species?.common_name}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(11,14,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.ivory, border: `1px solid ${DS.ink}`,
          width: '100%', maxWidth: 720, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '18px 24px', borderBottom: `1px solid ${DS.ink}`,
        }}>
          <div>
            <Mono size={10} letter={0.22} color={DS.ochre}>
              ◆ {isNew ? 'Add new species' : 'Edit species folio'}
            </Mono>
            <h2 style={{
              fontFamily: DS.serif, fontSize: 24, fontWeight: 300,
              letterSpacing: '-0.02em', margin: '4px 0 0', color: DS.ink,
            }}>
              {common.trim() || (isNew ? 'New library entry' : species?.common_name)}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `0.5px solid ${DS.inkHair}`,
            padding: '8px 14px', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
            color: DS.inkSoft, textTransform: 'uppercase',
          }}>Close</button>
        </div>

        <div style={{ overflow: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', background: DS.rust, color: DS.ivory,
              fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.15em',
              marginBottom: 16, textTransform: 'uppercase',
            }}>{error}</div>
          )}

          {/* Cover image */}
          <Section label="Cover plate">
            <div style={{
              display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 160, height: 120, background: DS.bone,
                border: `0.5px solid ${DS.inkHair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover"
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: DS.inkFaint, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <MonoIcon category={category} size={28} />
                    <Mono size={8} color={DS.inkFaint} letter={0.22}>No plate</Mono>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    background: DS.ink, color: DS.ivory, border: 'none',
                    padding: '10px 16px', cursor: uploading ? 'not-allowed' : 'pointer',
                    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
                    textTransform: 'uppercase', opacity: uploading ? 0.5 : 1,
                    alignSelf: 'flex-start',
                  }}
                >
                  {uploading ? 'Uploading…' : (coverUrl ? 'Replace cover' : 'Upload cover')}
                </button>
                {coverUrl && (
                  <button
                    onClick={clearCover}
                    disabled={uploading}
                    style={{
                      background: 'transparent', color: DS.rust,
                      border: `0.5px solid ${DS.rust}`,
                      padding: '8px 14px', cursor: uploading ? 'not-allowed' : 'pointer',
                      fontFamily: DS.mono, fontSize: 9, letterSpacing: '0.22em',
                      textTransform: 'uppercase', alignSelf: 'flex-start',
                    }}
                  >× Remove cover</button>
                )}
                <Mono size={8} letter={0.18} color={DS.inkFaint} style={{ marginTop: 4 }}>
                  JPG, PNG, or WebP. Stored against your account; the library is read-public.
                </Mono>
              </div>
            </div>
          </Section>

          {/* Names + category */}
          <Section label="Identification">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Common name *">
                <input
                  value={common}
                  onChange={(e) => setCommon(e.target.value)}
                  placeholder="e.g. Bengal Tiger"
                  style={inputStyle}
                />
              </Field>
              <Field label="Scientific name">
                <input
                  value={scientific}
                  onChange={(e) => setScientific(e.target.value)}
                  placeholder="e.g. Panthera tigris tigris"
                  style={inputStyle}
                />
              </Field>
              <Field label="Category *">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      style={{
                        padding: '8px 12px',
                        background: category === c ? DS.ink : 'transparent',
                        color: category === c ? DS.ivory : DS.ink,
                        border: `0.5px solid ${category === c ? DS.ink : DS.inkFaint}`,
                        cursor: 'pointer',
                        fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                      }}
                    >{c}</button>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Family (optional)">
                  <input
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    placeholder="e.g. Felidae"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Subcategory (optional)">
                  <input
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="e.g. Big cats"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* Description + habitat */}
          <Section label="Field notes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Field marks, behaviour, distinguishing features…"
                  style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                />
              </Field>
              <Field label="Habitat">
                <input
                  value={habitat}
                  onChange={(e) => setHabitat(e.target.value)}
                  placeholder="e.g. Sal forest, riverine"
                  style={inputStyle}
                />
              </Field>
            </div>
          </Section>

          {/* Flags */}
          <Section label="Flags">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Native status">
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    ['unknown',    'Unknown'],
                    ['native',     'Native'],
                    ['non_native', 'Non-native'],
                  ] as [NativeFlag, string][]).map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setNativeFlag(v)}
                      style={{
                        padding: '8px 12px',
                        background: nativeFlag === v ? DS.forest : 'transparent',
                        color: nativeFlag === v ? DS.ivory : DS.ink,
                        border: `0.5px solid ${nativeFlag === v ? DS.forest : DS.inkFaint}`,
                        cursor: 'pointer',
                        fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                      }}
                    >{l}</button>
                  ))}
                </div>
              </Field>
              <Field label="Notable species">
                <button
                  onClick={() => setIsNotable(v => !v)}
                  style={{
                    padding: '8px 14px', alignSelf: 'flex-start',
                    background: isNotable ? DS.rust : 'transparent',
                    color: isNotable ? DS.ivory : DS.ink,
                    border: `0.5px solid ${isNotable ? DS.rust : DS.inkFaint}`,
                    cursor: 'pointer',
                    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >{isNotable ? '● Notable' : '○ Not notable'}</button>
              </Field>
            </div>
          </Section>

          {/* Gallery */}
          <Section label={`Plates · gallery (${galleryUrls.length})`}>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryUpload}
              style={{ display: 'none' }}
            />
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: DS.ochre, color: DS.ink, border: 'none',
                  padding: '10px 16px', cursor: uploading ? 'not-allowed' : 'pointer',
                  fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
                  textTransform: 'uppercase', opacity: uploading ? 0.5 : 1,
                }}
              >+ Add gallery photos</button>
            </div>
            {galleryUrls.length === 0 ? (
              <Mono size={9} color={DS.inkFaint} letter={0.18}>
                No additional plates yet.
              </Mono>
            ) : (
              <div style={{
                display: 'grid', gap: 6,
                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              }}>
                {galleryUrls.map(url => (
                  <div key={url} style={{
                    position: 'relative', aspectRatio: '1 / 1',
                    border: `0.5px solid ${DS.inkHair}`, overflow: 'hidden',
                    background: DS.bone,
                  }}>
                    <img src={url} alt=""
                         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', inset: 'auto 0 0 0',
                      display: 'flex', justifyContent: 'space-between',
                      background: 'rgba(11,14,12,0.7)', padding: '4px 6px',
                    }}>
                      <button
                        onClick={() => makeCover(url)}
                        title="Make cover"
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
                          color: DS.ivory, textTransform: 'uppercase', padding: 0,
                        }}
                      >★ Cover</button>
                      <button
                        onClick={() => removeGallery(url)}
                        title="Remove"
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontFamily: DS.mono, fontSize: 8, letterSpacing: '0.18em',
                          color: DS.ivory, textTransform: 'uppercase', padding: 0,
                        }}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${DS.ink}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <Mono size={8} letter={0.2} color={DS.inkFaint}>
            Library entries are visible to everyone with access to the app.
          </Mono>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading || !common.trim()}
            style={{
              background: submitting || uploading || !common.trim() ? DS.inkFaint : DS.ochre,
              color: DS.ink, border: 'none',
              padding: '14px 26px',
              cursor: submitting || uploading || !common.trim() ? 'not-allowed' : 'pointer',
              fontFamily: DS.mono, fontSize: 11, letterSpacing: '0.28em',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >
            {submitting ? 'Saving…' : isNew ? 'Add to library' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <Mono size={9} letter={0.22} color={DS.ochre} style={{ marginBottom: 10 }}>
        ◆ {label.toUpperCase()}
      </Mono>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Mono size={9} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>{label}</Mono>
      {children}
    </div>
  )
}
