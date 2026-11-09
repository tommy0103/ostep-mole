import type { Extra } from './types'
import { VIRTUALIZATION_EXTRAS } from './virtualization'

const ALL: Record<number, Extra[]> = { ...VIRTUALIZATION_EXTRAS }

export const extrasFor = (chapter: number): Extra[] => ALL[chapter] ?? []
export const labCount = (chapter: number): number => extrasFor(chapter).filter((e) => e.kind === 'lab').length
export const allExtras = (): { chapter: number; extra: Extra }[] =>
  Object.entries(ALL).flatMap(([ch, xs]) => xs.map((extra) => ({ chapter: +ch, extra })))
