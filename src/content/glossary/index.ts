import type { Bi } from '@/lib/i18n'

/**
 * Terms our own writing (field notes, articles) uses without explaining. A reader of chapter 4 has
 * not met system calls yet, let alone seccomp, so each such term is marked in the text as
 * [[id|text]] and unfolds into one of these cards.
 *
 * A body is one to three sentences in the articles' inline markup and may mark further terms, which
 * open in the same card. `chapter` points to where the book explains it, `note` to a field note
 * that goes deeper. See docs/articles.md for when to mark a term.
 *
 * Entries live in the other files of this folder, each a default export of id → Term; they are
 * merged here. An id must be defined once (tests/articles.test.ts checks).
 */
export interface Term {
  title: Bi
  body: Bi
  chapter?: string
  note?: string
}

const modules = import.meta.glob<{ default: Record<string, Term> }>(['./*.ts', '!./index.ts'], { eager: true })

/** Each file's ids, for the duplicate check. */
export const GLOSSARY_FILES: Record<string, string[]> = Object.fromEntries(Object.entries(modules).map(([path, m]) => [path, Object.keys(m.default)]))

export const GLOSSARY: Record<string, Term> = Object.assign({}, ...Object.values(modules).map((m) => m.default))

export const findTerm = (id: string): Term | null => GLOSSARY[id] ?? null
