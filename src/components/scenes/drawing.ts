import { computed } from 'vue'
import type { Lang } from '@/lib/types'
import './drawing.css'

/**
 * What every scene drawing takes (see docs/scenes.md). `state`: the passage being read; `lit`: parts
 * the reader asked about, drawn in the accent colour; `demo`/`step`: a demo playing, which the
 * drawing may hand to a component of its own; `band`: only these rows ([top, bottom] in the
 * drawing's units), when the drawing sits in the text.
 */
export interface DrawingProps {
  state: string
  lit: string[]
  lang: Lang
  demo?: boolean
  step?: number
  band?: [number, number] | null
}

/** Readers who asked for less motion get still drawings. */
export const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The common workings of a drawing 360 units wide and `height` tall. `show` lists, per state, the
 * parts on view; a lit part is shown too. Use `:class="part('id')"` on each part's group (a part
 * fades in and out with the state) and `L(en, zh)` for its words.
 */
export function useDrawing(props: DrawingProps, show: Record<string, string[]>, height: number) {
  const first = Object.keys(show)[0]
  const shown = computed(() => new Set([...(show[props.state] ?? show[first]), ...props.lit]))
  const part = (id: string) => ['part', { on: shown.value.has(id), lit: props.lit.includes(id) }]
  const L = (en: string, zh: string) => (props.lang === 'zh' ? zh : en)
  const viewBox = computed(() => (props.band ? `0 ${props.band[0]} 360 ${props.band[1] - props.band[0]}` : `0 0 360 ${height}`))
  return { shown, part, L, viewBox, still }
}
