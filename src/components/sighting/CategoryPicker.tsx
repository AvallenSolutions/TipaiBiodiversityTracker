import { Cat, Bird, Turtle, Droplets, Bug, Leaf, Flower2, Footprints, type LucideIcon } from 'lucide-react'
import type { SightingCategory } from '@/types'

interface CategoryPickerProps {
  onSelect: (category: SightingCategory) => void
}

interface CategoryOption {
  value: SightingCategory
  label: string
  icon: LucideIcon
  bg: string
  ring: string
}

const categories: CategoryOption[] = [
  { value: 'mammal',    label: 'Mammal',    icon: Cat,        bg: 'bg-amber-100 text-amber-700',    ring: 'ring-amber-300' },
  { value: 'bird',      label: 'Bird',      icon: Bird,       bg: 'bg-sky-100 text-sky-700',        ring: 'ring-sky-300' },
  { value: 'reptile',   label: 'Reptile',   icon: Turtle,     bg: 'bg-lime-100 text-lime-700',      ring: 'ring-lime-300' },
  { value: 'amphibian', label: 'Amphibian', icon: Droplets,   bg: 'bg-teal-100 text-teal-700',      ring: 'ring-teal-300' },
  { value: 'insect',    label: 'Insect',    icon: Bug,        bg: 'bg-orange-100 text-orange-700',  ring: 'ring-orange-300' },
  { value: 'plant',     label: 'Plant',     icon: Leaf,       bg: 'bg-green-100 text-green-700',    ring: 'ring-green-300' },
  { value: 'fungi',     label: 'Fungi',     icon: Flower2,    bg: 'bg-purple-100 text-purple-700',  ring: 'ring-purple-300' },
  { value: 'trace',     label: 'Trace',     icon: Footprints, bg: 'bg-stone-100 text-stone-700',    ring: 'ring-stone-300' },
]

export default function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">What did you find?</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map(({ value, label, icon: Icon, bg, ring }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 ${bg} transition-all duration-150 active:scale-95 hover:ring-2 ${ring} focus:outline-none focus:ring-2 ${ring}`}
          >
            <Icon className="h-8 w-8" strokeWidth={1.75} />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
