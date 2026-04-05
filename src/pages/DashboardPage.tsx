import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Eye,
  ShieldCheck,
  Sparkles,
  Leaf,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  Map,
} from 'lucide-react'
import { format } from 'date-fns'
import { useSightings } from '@/hooks/useSightings'
import { exportToCSV, exportToJSON, exportToGeoJSON } from '@/lib/export'
import type { SightingCategory, VerificationStatus } from '@/types'

const CATEGORIES: { value: '' | SightingCategory; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'mammal', label: 'Mammal' },
  { value: 'bird', label: 'Bird' },
  { value: 'reptile', label: 'Reptile' },
  { value: 'amphibian', label: 'Amphibian' },
  { value: 'insect', label: 'Insect' },
  { value: 'plant', label: 'Plant' },
  { value: 'fungi', label: 'Fungi' },
  { value: 'trace', label: 'Trace' },
]

const STATUSES: { value: '' | VerificationStatus; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'ai_suggested', label: 'AI Suggested' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
]

const categoryBadge: Record<SightingCategory, string> = {
  mammal: 'bg-amber-100 text-amber-700',
  bird: 'bg-sky-100 text-sky-700',
  reptile: 'bg-lime-100 text-lime-700',
  amphibian: 'bg-teal-100 text-teal-700',
  insect: 'bg-orange-100 text-orange-700',
  plant: 'bg-green-100 text-green-700',
  fungi: 'bg-purple-100 text-purple-700',
  trace: 'bg-stone-100 text-stone-700',
}

const statusBadge: Record<VerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  ai_suggested: 'bg-indigo-100 text-indigo-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { sightings, loading, error, fetchSightings } = useSightings()

  // Filters
  const [filterCategory, setFilterCategory] = useState<'' | SightingCategory>('')
  const [filterStatus, setFilterStatus] = useState<'' | VerificationStatus>('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setFilterSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    fetchSightings({
      category: filterCategory || undefined,
      verificationStatus: filterStatus || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      search: filterSearch || undefined,
    })
  }, [fetchSightings, filterCategory, filterStatus, filterDateFrom, filterDateTo, filterSearch])

  // Stats
  const stats = useMemo(() => {
    const verified = sightings.filter(s => s.verification_status === 'verified').length
    const aiSuggested = sightings.filter(s => s.verification_status === 'ai_suggested').length
    const speciesIds = new Set(sightings.filter(s => s.species_id).map(s => s.species_id))
    return {
      total: sightings.length,
      verified,
      aiSuggested,
      speciesCount: speciesIds.size,
    }
  }, [sightings])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Category */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as '' | SightingCategory)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as '' | VerificationStatus)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Date from */}
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        {/* Date to */}
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          label="Total"
          value={stats.total}
          color="emerald"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Verified"
          value={stats.verified}
          color="sky"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="AI Suggested"
          value={stats.aiSuggested}
          color="indigo"
        />
        <StatCard
          icon={<Leaf className="h-4 w-4" />}
          label="Species"
          value={stats.speciesCount}
          color="amber"
        />
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => exportToCSV(sightings)}
          disabled={sightings.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export CSV
        </button>
        <button
          onClick={() => exportToJSON(sightings)}
          disabled={sightings.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
        >
          <FileJson className="h-4 w-4" />
          Export JSON
        </button>
        <button
          onClick={() => exportToGeoJSON(sightings)}
          disabled={sightings.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
        >
          <Map className="h-4 w-4" />
          Export GeoJSON
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Table */}
      {!loading && sightings.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <Leaf className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No sightings match your filters</p>
        </div>
      )}

      {!loading && sightings.length > 0 && (
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Species</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Observer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sightings.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/sighting/${s.id}`)}
                  className="cursor-pointer transition hover:bg-emerald-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {format(new Date(s.sighted_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryBadge[s.category]}`}
                    >
                      {s.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {s.common_name || <span className="text-gray-400">Unidentified</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.profile?.display_name || s.profile?.email || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[s.verification_status]}`}
                    >
                      {s.verification_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ExportBadge
                      inaturalist={s.inaturalist_status}
                      ebird={s.ebird_status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'emerald' | 'sky' | 'indigo' | 'amber'
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  const valueColorMap = {
    emerald: 'text-emerald-800',
    sky: 'text-sky-800',
    indigo: 'text-indigo-800',
    amber: 'text-amber-800',
  }

  return (
    <div className={`rounded-xl p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${valueColorMap[color]}`}>{value}</p>
    </div>
  )
}

function ExportBadge({
  inaturalist,
  ebird,
}: {
  inaturalist: string
  ebird: string
}) {
  const badgeColor = (status: string) => {
    switch (status) {
      case 'exported':
        return 'bg-emerald-100 text-emerald-700'
      case 'pending':
        return 'bg-amber-100 text-amber-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'excluded':
        return 'bg-gray-200 text-gray-500'
      default:
        return 'bg-gray-100 text-gray-400'
    }
  }

  return (
    <div className="flex gap-1">
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeColor(inaturalist)}`}
        title={`iNaturalist: ${inaturalist}`}
      >
        iNat
      </span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeColor(ebird)}`}
        title={`eBird: ${ebird}`}
      >
        eBird
      </span>
    </div>
  )
}
