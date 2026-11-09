import type { InjectionKey } from 'vue'

/**
 * Where a clicked term opens. A block of our writing provides a scope: beside an article's scene
 * (src/lib/scene.ts) the term lights up in the drawing; elsewhere it opens as a card below the block.
 * A card provides its own scope, so a term inside it opens in the same card, one step deeper.
 */
export interface TermScope {
  open(id: string): void
  isOpen(id: string): boolean
}

export const TERM_SCOPE: InjectionKey<TermScope> = Symbol('term-scope')
