import { PARTS } from '@/content/book'
import { allExtras } from './index'
import type { NoteExtra } from './types'

export interface NoteEntry {
  note: NoteExtra
  chapter: number
  /** the chapter the note sits in */
  slug: string
  part: string
}

/** Every field note and thread, in book order. */
export function allNotes(): NoteEntry[] {
  return allExtras()
    .filter((x) => x.extra.kind === 'note' || x.extra.kind === 'thread')
    .sort((a, b) => a.chapter - b.chapter)
    .map(({ chapter, extra }) => {
      const part = PARTS.find((p) => p.chapters.some((c) => c.num === chapter))!
      return { note: extra as NoteExtra, chapter, slug: part.chapters.find((c) => c.num === chapter)!.slug, part: part.id }
    })
}

export const findNote = (id: string) => allNotes().find((n) => n.note.id === id) ?? null
