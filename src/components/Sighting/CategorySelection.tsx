import { Cat, Bird, Radar, Bug, Leaf, Footprints, Flower2 } from 'lucide-react'
import { CategoryType } from '../../types/database'

interface CategorySelectionProps {
  onSelect: (category: CategoryType) => void
}

const categories = [
  { type: 'mammal' as CategoryType, icon: Cat, label: 'Mammal', color: 'bg-orange-500' },
  { type: 'bird' as CategoryType, icon: Bird, label: 'Bird', color: 'bg-sky-500' },
  { type: 'lizard' as CategoryType, icon: Radar, label: 'Lizard', color: 'bg-green-500' },
  { type: 'insect' as CategoryType, icon: Bug, label: 'Insect', color: 'bg-purple-500' },
  { type: 'plant' as CategoryType, icon: Leaf, label: 'Plant', color: 'bg-emerald-500' },
  { type: 'trace' as CategoryType, icon: Footprints, label: 'Trace', color: 'bg-amber-600' },
  { type: 'fungi' as CategoryType, icon: Flower2, label: 'Fungi', color: 'bg-red-500' }
]

export default function CategorySelection({ onSelect }: CategorySelectionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-stone-50 to-tipai-stone-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="font-heading text-3xl font-semibold text-tipai-green-900 text-center mb-2">
          New Sighting
        </h1>
        <p className="text-center text-gray-600 mb-8">
          What did you see?
        </p>

        <div className="grid grid-cols-2 gap-4">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.type}
                onClick={() => onSelect(category.type)}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
              >
                <div className={`${category.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <p className="text-lg font-semibold text-gray-800 text-center">
                  {category.label}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
