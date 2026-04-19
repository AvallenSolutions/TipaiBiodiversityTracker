export const DS = {
  ivory: '#F4EEE2',
  paper: '#E8E2D3',
  bone: '#D9CEB6',
  ink: '#1c2520',
  inkSoft: 'rgba(28,37,32,0.6)',
  inkFaint: 'rgba(28,37,32,0.3)',
  inkHair: 'rgba(28,37,32,0.15)',
  forest: '#3f5048',
  ochre: '#B8935A',
  rust: '#A0503C',
  serif: '"Newsreader", Georgia, serif',
  sans: '"Inter Tight", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const

export function normalizeConf(ai_confidence: number | null | undefined): number {
  if (ai_confidence == null) return 0
  return ai_confidence > 1 ? ai_confidence / 100 : ai_confidence
}

export function getFlag(conf: number, hasNoSpecies: boolean): string | null {
  if (hasNoSpecies) return 'needs-id'
  if (conf === 0) return 'needs-id'
  if (conf < 0.5) return 'low-confidence'
  return null
}

export function catLetter(cat: string): string {
  switch (cat) {
    case 'mammal': return 'M'
    case 'bird': return 'B'
    case 'reptile': return 'R'
    case 'amphibian': return 'A'
    case 'insect': return 'I'
    case 'plant': return 'P'
    case 'fungi': return 'F'
    case 'trace': return 'T'
    default: return '·'
  }
}
