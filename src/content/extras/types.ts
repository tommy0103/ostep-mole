import type { Bi } from '@/lib/i18n'

/**
 * Something we add to the book: an interactive lab, a field note connecting the chapter to
 * real-world systems, or a "thread" that ties ideas across chapters.
 *
 * `at` places it in the chapter, using identifiers shared by both languages:
 *   'intro'     before the first section
 *   'head:7.3'  right after the heading of section 7.3
 *   'sec:7.3'   at the end of section 7.3
 *   'fig:7.2'   right after figure 7.2
 *   'end'       before the references
 */
export interface LabExtra {
  kind: 'lab'
  id: string
  at: string
  lab: string
  title: Bi
  props?: Record<string, unknown>
}

export interface NoteExtra {
  kind: 'note' | 'thread'
  id: string
  at: string
  title: Bi
  /** paragraphs; may contain `inline code` and **bold** */
  body: Bi[]
  /** related chapters by slug */
  links?: string[]
  /** short tags shown as chips, e.g. "Linux 6.6", "vLLM" */
  tags?: string[]
}

export type Extra = LabExtra | NoteExtra
