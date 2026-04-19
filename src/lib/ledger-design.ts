export const DS = {
  ivory:    '#F4EEE2',
  paper:    '#E8E2D3',
  bone:     '#D9CEB6',
  ink:      '#1C2520',
  inkSoft:  'rgba(28,37,32,0.6)',
  inkFaint: 'rgba(28,37,32,0.3)',
  inkHair:  'rgba(28,37,32,0.15)',
  forest:   '#3F5048',
  ochre:    '#B8935A',
  rust:     '#A0503C',
  serif:    '"Newsreader", Georgia, serif',
  sans:     '"Inter Tight", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, monospace',
} as const

export function normalizeConf(v: number | null | undefined): number {
  if (v == null) return 0
  return v > 1 ? v / 100 : v
}

export function getFlag(conf: number, hasNoSpecies: boolean): string | null {
  if (hasNoSpecies) return 'UNIDENTIFIED'
  if (conf < 0.5 && conf > 0) return 'LOW CONF'
  return null
}

export function catLetter(cat: string): string {
  const map: Record<string, string> = {
    mammal: 'M', bird: 'B', reptile: 'R', amphibian: 'A',
    insect: 'I', plant: 'P', fungi: 'F', trace: 'T',
  }
  return map[cat] ?? '?'
}
