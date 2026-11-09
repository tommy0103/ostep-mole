import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { Lang } from './types'
import type { SceneSpec, SceneState } from '@/content/scenes'

/**
 * A scene is an article's running figure: one drawing of the system the article is about, which
 * changes as the reader moves through it (`::scene state` markers in the article).
 *
 * It takes one of three shapes. `side`: a column kept to the right of the text, where a clicked
 * term lights up in the drawing and is explained under it. `float`: the same panel floating over
 * the page where there is no room for a column, which the reader can drag aside or fold to a bar.
 * `inline`, on a phone: the drawing appears in the text where each state begins, cut to the part
 * that state is about, and a clicked term opens a card under its paragraph with its part of the
 * drawing.
 */
export type SceneShape = 'side' | 'float' | 'inline'

export interface SceneLayer {
  shape: Readonly<Ref<SceneShape | null>>
  spec: Readonly<Ref<SceneSpec | null>>
  /** the drawing's language */
  lang: Readonly<Ref<Lang>>
  /** the languages its words are given in */
  langs: Readonly<Ref<Lang[]>>
  /** the state of the passage being read */
  state: Ref<string>
  /** terms followed from the text, outermost first (side and float shapes) */
  trail: Ref<string[]>
  /** a term clicked in the text: show it, or put it away if it is the one shown */
  open(id: string): void
}

export const SCENE_LAYER: InjectionKey<SceneLayer> = Symbol('scene-layer')

export function useScene(o: Pick<SceneLayer, 'shape' | 'spec' | 'lang' | 'langs'>): SceneLayer {
  const state = ref('')
  const trail = ref<string[]>([])
  const open = (id: string) => (trail.value = trail.value[0] === id && trail.value.length === 1 ? [] : [id])
  return { ...o, state, trail, open }
}

/**
 * Keep `layer.state` on the passage being read: the last `[data-scene]` block above the middle of
 * the window (a block inside a closed fold does not count), or the first state before any.
 */
export function trackScene(layer: SceneLayer) {
  let frame = 0
  function track() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const spec = layer.spec.value
      if (!spec) return
      const line = window.innerHeight * 0.5
      let current = Object.keys(spec.states)[0]
      for (const block of document.querySelectorAll<HTMLElement>('[data-scene]')) {
        const fold = block.parentElement?.closest('.box.fold')
        if (fold && !fold.classList.contains('open')) continue
        if (block.getBoundingClientRect().top < line) current = block.dataset.scene!
      }
      layer.state.value = current
    })
  }
  onMounted(() => {
    window.addEventListener('scroll', track, { passive: true })
    window.addEventListener('resize', track)
    window.addEventListener('click', track)
    track()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', track)
    window.removeEventListener('resize', track)
    window.removeEventListener('click', track)
  })
  return track
}

/** The rows of the drawing a band shows, from the parts it must include (padded, whole height at most). */
export function bandOf(spec: SceneSpec, parts: string[]): [number, number] | null {
  const rows = parts.flatMap((p) => (spec.parts[p] ? [spec.parts[p]] : []))
  if (!rows.length) return null
  const PAD = 12
  return [Math.max(0, Math.min(...rows.map((r) => r[0])) - PAD), Math.min(spec.height, Math.max(...rows.map((r) => r[1])) + PAD)]
}

/** Playing a state's demo: a step at a time, advancing on its own until paused. */
export function useDemo(state: ComputedRef<SceneState>, STEP_MS = 4500) {
  const demo = computed(() => state.value.demo)
  const step = ref(-1)
  const playing = ref(false)
  let timer = 0
  function pause() {
    clearInterval(timer)
    playing.value = false
  }
  function play() {
    pause()
    if (step.value < 0 || step.value >= demo.value!.steps.length - 1) step.value = 0
    playing.value = true
    timer = window.setInterval(() => {
      if (step.value < demo.value!.steps.length - 1) step.value++
      else pause()
    }, STEP_MS)
  }
  const go = (d: number) => {
    pause()
    step.value = Math.min(Math.max(step.value + d, 0), demo.value!.steps.length - 1)
  }
  const exit = () => {
    pause()
    step.value = -1
  }
  watch(state, exit)
  onBeforeUnmount(pause)
  return { demo, step, playing, play, pause, go, exit }
}
