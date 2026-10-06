import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import { identifySpecies, learnFromSightingRecord } from '@/lib/gemini'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import type { AISuggestion, Sighting } from '@/types'

// Admin panel for the AI identifier: live hit rates from stored sightings,
// the most confused species pairs, and two tools:
//   - Teach: add every confirmed record that is not yet in the AI's photo
//     memory (the backfill for sightings logged before v2, or offline).
//   - Test: re-identify recent confirmed records with the current AI,
//     leaving each record out of the memory, and score the answers.

interface EngineStat { engine: string; total: number; top1: number; top3: number }
interface Stats {
  by_engine: EngineStat[]
  confusions: { ai_said: string; actual: string; count: number }[]
  examples: number
  tips: number
}

type Record = Pick<Sighting, 'id' | 'common_name' | 'scientific_name' | 'species_id' | 'latitude' | 'longitude' | 'park' | 'sighted_at' | 'media' | 'verification_status'> & {
  profile?: { role: string } | null
}

interface TestRow { id: string; actual: string; aiTop: string; top1: boolean; top3: boolean; error?: string }

const TEST_SIZE = 20

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

function sameSpecies(s: AISuggestion, r: Record): boolean {
  return (!!r.species_id && s.species_id === r.species_id)
    || (!!norm(s.common_name) && norm(s.common_name) === norm(r.common_name))
    || (!!norm(s.scientific_name) && norm(s.scientific_name) === norm(r.scientific_name))
}

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}%` : 'n/a'
}

async function loadConfirmedRecords(): Promise<Record[]> {
  const { data, error } = await (supabase.from('sightings') as any)
    .select('id, common_name, scientific_name, species_id, latitude, longitude, park, sighted_at, verification_status, media:sighting_media(*), profile:profiles!sightings_user_id_fkey(role)')
    .not('common_name', 'is', null)
    .neq('verification_status', 'rejected')
    .order('sighted_at', { ascending: false })
  if (error) throw error
  // Confirmed = logged by a naturalist/admin, or verified by one.
  return ((data ?? []) as Record[]).filter(r =>
    r.media?.some(m => m.media_type === 'photo') &&
    (r.verification_status === 'verified' || r.profile?.role === 'naturalist' || r.profile?.role === 'admin'))
}

export function AiAccuracyPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [teach, setTeach] = useState<{ done: number; total: number; failed: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testRows, setTestRows] = useState<TestRow[]>([])

  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)('ai_accuracy_stats')
    if (error) setError(error.message)
    else setStats(data as Stats)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  async function runTeach() {
    setError(null)
    try {
      const [records, { data: existing }] = await Promise.all([
        loadConfirmedRecords(),
        (supabase.from('species_examples') as any).select('sighting_id'),
      ])
      const known = new Set(((existing ?? []) as { sighting_id: string }[]).map(e => e.sighting_id))
      const todo = records.filter(r => !known.has(r.id))
      const progress = { done: 0, total: todo.length, failed: 0 }
      setTeach({ ...progress })
      for (const r of todo) {
        try {
          await learnFromSightingRecord(r)
        } catch (err) {
          console.warn('[teach] failed', r.id, err)
          progress.failed++
        }
        progress.done++
        setTeach({ ...progress })
      }
      await loadStats()
    } catch (err: any) {
      setError(err?.message || 'Teaching failed')
    }
  }

  async function runTest() {
    setError(null)
    setTesting(true)
    setTestRows([])
    try {
      const records = (await loadConfirmedRecords()).slice(0, TEST_SIZE)
      const rows: TestRow[] = []
      for (const r of records) {
        const photo = r.media!.find(m => m.media_type === 'photo')!
        try {
          const blob = await fetch(getMediaUrl(photo.storage_path)).then(res => res.blob())
          // Category left blank on purpose: the harder, more honest test.
          const suggestions = await identifySpecies(blob, null, {
            latitude: r.latitude, longitude: r.longitude, park: r.park,
            sighted_at: r.sighted_at, exclude_sighting_id: r.id,
          })
          rows.push({
            id: r.id,
            actual: r.common_name ?? '',
            aiTop: suggestions[0]?.common_name ?? 'no answer',
            top1: !!suggestions[0] && sameSpecies(suggestions[0], r),
            top3: suggestions.slice(0, 3).some(s => sameSpecies(s, r)),
          })
        } catch (err: any) {
          rows.push({ id: r.id, actual: r.common_name ?? '', aiTop: 'no answer', top1: false, top3: false, error: err?.message })
        }
        setTestRows([...rows])
      }
    } catch (err: any) {
      setError(err?.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const scored = testRows.filter(r => !r.error)
  const btn: React.CSSProperties = {
    padding: '10px 14px', background: DS.ink, color: DS.ivory, border: 'none', cursor: 'pointer',
    fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  }
  const teaching = !!teach && teach.done < teach.total

  return (
    <div style={{ marginTop: 40, borderTop: `3px double ${DS.ink}`, paddingTop: 12 }}>
      <Mono size={9} letter={0.22} color={DS.ochre}>◆ AI identifier</Mono>
      <h2 style={{ fontFamily: DS.serif, fontSize: 24, fontWeight: 300, margin: '6px 0 4px', color: DS.ink }}>
        AI accuracy
      </h2>
      <p style={{ fontFamily: DS.serif, fontSize: 13, fontStyle: 'italic', color: DS.inkSoft, margin: '0 0 16px' }}>
        How often the AI's answer matched the species saved on the record. "Top 1" means its first answer was right; "top 3" means the right species was in its list.
      </p>

      {error && (
        <div style={{ padding: '8px 12px', background: DS.rust, color: DS.ivory, fontFamily: DS.mono, fontSize: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {stats.by_engine.map(e => (
              <div key={e.engine} style={{ border: `0.5px solid ${DS.inkHair}`, padding: 12, background: DS.ivory }}>
                <Mono size={8} letter={0.2} color={DS.inkSoft}>{e.engine === 'v1' ? 'Old AI (v1)' : `New AI (${e.engine})`} · {e.total} records</Mono>
                <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, color: DS.ink, marginTop: 6 }}>
                  {pct(e.top1, e.total)} <span style={{ fontSize: 13, color: DS.inkSoft }}>top 1</span>
                </div>
                <div style={{ fontFamily: DS.serif, fontSize: 15, fontWeight: 300, color: DS.inkSoft }}>
                  {pct(e.top3, e.total)} top 3
                </div>
              </div>
            ))}
            <div style={{ border: `0.5px solid ${DS.inkHair}`, padding: 12, background: DS.ivory }}>
              <Mono size={8} letter={0.2} color={DS.inkSoft}>AI memory</Mono>
              <div style={{ fontFamily: DS.serif, fontSize: 22, fontWeight: 300, color: DS.ink, marginTop: 6 }}>
                {stats.examples} <span style={{ fontSize: 13, color: DS.inkSoft }}>photos</span>
              </div>
              <div style={{ fontFamily: DS.serif, fontSize: 15, fontWeight: 300, color: DS.inkSoft }}>{stats.tips} look-alike tips</div>
            </div>
          </div>

          {stats.confusions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Mono size={8} letter={0.2} color={DS.inkSoft} style={{ marginBottom: 6 }}>Most common mistakes</Mono>
              {stats.confusions.map((c, i) => (
                <div key={i} style={{ fontFamily: DS.serif, fontSize: 14, color: DS.ink, padding: '4px 0', borderBottom: `0.5px dashed ${DS.inkHair}` }}>
                  AI said <em>{c.ai_said || 'nothing'}</em>, it was <strong style={{ fontWeight: 400 }}>{c.actual}</strong>
                  <span style={{ color: DS.inkSoft }}> · {c.count}×</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={runTeach} disabled={teaching || testing} style={{ ...btn, opacity: teaching || testing ? 0.5 : 1 }}>
          {teaching ? `Teaching ${teach!.done} / ${teach!.total}` : 'Teach AI from confirmed records'}
        </button>
        <button onClick={runTest} disabled={teaching || testing} style={{ ...btn, background: DS.forest, opacity: teaching || testing ? 0.5 : 1 }}>
          {testing ? `Testing ${testRows.length} / ${TEST_SIZE}` : `Test the AI on ${TEST_SIZE} records`}
        </button>
      </div>

      {teach && !teaching && (
        <Mono size={9} color={DS.inkSoft} letter={0.15} style={{ marginBottom: 12 }}>
          {teach.total === 0 ? 'Every confirmed record is already in the AI memory.' : `Taught ${teach.total - teach.failed} records${teach.failed ? ` · ${teach.failed} failed` : ''}.`}
        </Mono>
      )}

      {testRows.length > 0 && (
        <div>
          <Mono size={9} letter={0.18} color={DS.ink} style={{ marginBottom: 6 }}>
            Test: top 1 {pct(scored.filter(r => r.top1).length, scored.length)} · top 3 {pct(scored.filter(r => r.top3).length, scored.length)} · {scored.length} scored{testRows.length - scored.length ? ` · ${testRows.length - scored.length} errors` : ''}
          </Mono>
          {testRows.map(r => (
            <div key={r.id} style={{ fontFamily: DS.serif, fontSize: 13, padding: '3px 0', color: r.top1 ? DS.forest : r.top3 ? DS.ochre : DS.rust }}>
              {r.top1 ? '●' : r.top3 ? '◐' : '○'} {r.actual} → {r.error ? `error: ${r.error}` : r.aiTop}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
