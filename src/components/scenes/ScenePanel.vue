<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { TERM_SCOPE } from '@/lib/terms'
import { SCENE_LAYER, useDemo } from '@/lib/scene'
import { findTerm } from '@/content/glossary'
import TermBody from '../terms/TermBody.vue'

/**
 * An article's scene as a column: the drawing in the state of the passage being read, and with it
 * either that state's caption or the term the reader clicked, with the path back if they followed
 * terms inside its explanation. The page keeps the state on the passage being read (trackScene).
 *
 * A state may carry a demo: the reader starts it, the drawing switches to the mechanism, and the
 * caption follows its steps (advancing on its own until paused). Reading on ends it.
 *
 * `floating`: over the page where there is no room for a column. It starts in the top right corner;
 * the reader can drag it by its bar and fold it to the bar, and it remembers both.
 * `overlay`: the whole screen, for a demo started from a scene in the text; it plays at once and
 * closes with the demo.
 */
/** `state` pins the scene to one state (an overlay's demo), whatever the page is tracking */
const props = defineProps<{ floating?: boolean; overlay?: boolean; state?: string }>()
const emit = defineEmits<{ close: [] }>()
const layer = inject(SCENE_LAYER)!
const spec = computed(() => layer.spec.value!)
const lang = computed(() => layer.lang.value)
const words = computed(() => layer.langs.value)
const zh = computed(() => lang.value === 'zh')
const order = computed(() => Object.keys(spec.value.states))
const current = computed(() => props.state ?? layer.state.value)
const state = computed(() => spec.value.states[current.value] ?? spec.value.states[order.value[0]])

const id = computed(() => layer.trail.value[layer.trail.value.length - 1])
// light up the deepest term on the path that has a place in the drawing
const lit = computed(() => {
  for (const t of [...layer.trail.value].reverse()) if (spec.value.terms[t]) return spec.value.terms[t]
  return []
})
provide(TERM_SCOPE, {
  open: (t) => {
    const at = layer.trail.value.indexOf(t)
    layer.trail.value = at >= 0 ? layer.trail.value.slice(0, at + 1) : [...layer.trail.value, t]
  },
  isOpen: (t) => layer.trail.value.includes(t),
})

const { demo, step, playing, play, pause, go, exit } = useDemo(state)
const leave = () => {
  exit()
  if (props.overlay) emit('close')
}
const title = computed(() => (step.value >= 0 && demo.value ? demo.value.label[lang.value] : state.value.title[lang.value]))
const label = (t: string) => findTerm(t)?.title[lang.value].replace(/[（(].*$/, '').trim() ?? t

// floating: where it is (from the top right corner, so it stays put as the window resizes) and folded
const KEY = 'ostep.scene.float'
const MARGIN = 12
const el = ref<HTMLElement>()
const pos = ref({ right: 20, top: 76 })
const folded = ref(false)
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  if (saved?.pos) pos.value = saved.pos
  if (typeof saved?.folded === 'boolean') folded.value = saved.folded
} catch {
  /* storage may be unavailable */
}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pos: pos.value, folded: folded.value }))
  } catch {
    /* ignore */
  }
}
watch(folded, save)
/** keep the whole bar on screen */
function clamp() {
  const box = el.value?.getBoundingClientRect()
  if (!box) return
  const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 56
  pos.value = {
    right: Math.min(Math.max(pos.value.right, MARGIN), window.innerWidth - box.width - MARGIN),
    top: Math.min(Math.max(pos.value.top, topbar + 8), window.innerHeight - 48),
  }
}
let drag: { x: number; y: number; right: number; top: number; moved: boolean } | null = null
function grab(e: PointerEvent) {
  if (!props.floating || (e.target as HTMLElement).closest('button')) return
  drag = { x: e.clientX, y: e.clientY, right: pos.value.right, top: pos.value.top, moved: false }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
  pos.value = { right: drag.right - dx, top: drag.top + dy }
  clamp()
}
function drop() {
  if (drag?.moved) save()
  drag = null
}
// a folded panel unfolds when there is something to show in it
watch(
  () => [layer.trail.value.length, step.value],
  ([n, st]) => (n > 0 || st >= 0) && (folded.value = false),
)
const onResize = () => props.floating && clamp()

const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (props.overlay) leave()
  else layer.trail.value = layer.trail.value.slice(0, -1)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (props.overlay) play()
  if (props.floating) {
    window.addEventListener('resize', onResize)
    requestAnimationFrame(clamp)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <aside
    ref="el"
    class="scene-panel"
    :class="{ overlay, floating, folded: floating && folded }"
    :style="floating ? { right: pos.right + 'px', top: pos.top + 'px', maxHeight: `calc(100vh - ${pos.top + MARGIN}px)` } : undefined"
    :lang="lang"
    :role="overlay ? 'dialog' : undefined"
    :aria-modal="overlay || undefined"
  >
    <div class="kicker mono" :class="{ grip: floating }" @pointerdown="grab" @pointermove="move" @pointerup="drop" @pointercancel="drop">
      <span>{{ zh ? '图景' : 'scene' }}</span>
      <span v-if="!overlay" class="steps" aria-hidden="true">
        <i v-for="s in order" :key="s" :class="{ here: s === current }" />
      </span>
      <button v-if="floating" type="button" class="fold-btn" :aria-expanded="!folded" :aria-label="folded ? (zh ? '展开图景' : 'show the scene') : zh ? '收起图景' : 'fold the scene'" @click="folded = !folded">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path :d="folded ? 'M2 4l4 4 4-4' : 'M2 8l4-4 4 4'" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
      </button>
    </div>
    <div :key="title" class="stitle">{{ title }}</div>
    <component
      v-show="!(floating && folded)" :is="spec.drawing" :state="current" :lit="lit" :lang="lang" :demo="step >= 0" :step="step" class="drawing" />
    <div v-show="!(floating && folded)" class="explain">
      <template v-if="step >= 0 && demo">
        <div class="controls mono">
          <button type="button" :disabled="step === 0" :aria-label="zh ? '上一步' : 'previous step'" @click="go(-1)">‹</button>
          <span class="count">{{ step + 1 }} / {{ demo.steps.length }}</span>
          <button type="button" :disabled="step === demo.steps.length - 1" :aria-label="zh ? '下一步' : 'next step'" @click="go(1)">›</button>
          <button type="button" class="pp" @click="playing ? pause() : play()">{{ playing ? (zh ? '暂停' : 'pause') : zh ? '播放' : 'play' }}</button>
          <button type="button" class="close" :aria-label="zh ? '退出演示' : 'leave the demo'" @click="leave">×</button>
        </div>
        <p v-for="l in words" :key="step + l" class="caption" :lang="l">{{ demo.steps[step][l] }}</p>
      </template>
      <template v-else-if="id">
        <div class="top mono">
          <nav class="trail" :aria-label="zh ? '术语路径' : 'term path'">
            <template v-for="(t, i) in layer.trail.value" :key="t">
              <button v-if="i < layer.trail.value.length - 1" type="button" class="step" @click="layer.trail.value = layer.trail.value.slice(0, i + 1)">{{ label(t) }}</button>
              <span v-else class="step here">{{ label(t) }}</span>
              <span v-if="i < layer.trail.value.length - 1" class="sep" aria-hidden="true">›</span>
            </template>
          </nav>
          <button type="button" class="close" :aria-label="zh ? '收起' : 'close'" @click="layer.trail.value = []">×</button>
        </div>
        <TermBody v-for="l in words" :key="id + l" class="term" :id="id" :lang="l" />
        <p v-if="!spec.terms[id]" class="note mono">{{ zh ? '这个概念不在图里，只有文字说明。' : 'Not in the drawing: explained in words only.' }}</p>
      </template>
      <template v-else>
        <p v-for="l in words" :key="current + l" class="caption" :lang="l">{{ state.caption[l] }}</p>
        <button v-if="demo" type="button" class="watch" @click="play">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
          {{ zh ? '看它怎么发生' : 'Watch how it works' }}<span class="mono">· {{ demo.steps.length }} {{ zh ? '步' : 'steps' }}</span>
        </button>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.scene-panel {
  position: sticky;
  top: calc(var(--topbar-h) + 24px);
  align-self: start;
  max-height: calc(100vh - var(--topbar-h) - 48px);
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding: 14px 16px 16px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-elev);
  transition: opacity 0.25s;
}
/* the panel's own words; the drawing sets its own fonts */
.scene-panel:lang(zh),
.scene-panel [lang='zh'] {
  font-family: var(--font-zh);
}
/* over the page, out of the way of the text */
.floating {
  position: fixed;
  z-index: 40;
  width: 320px;
  gap: 6px;
  padding: 10px 14px 14px;
  box-shadow: 0 12px 32px -14px rgb(0 0 0 / 0.35);
}
.floating.folded {
  width: 260px;
  padding-bottom: 10px;
}
.floating .explain {
  min-height: 0;
}
/* the bar stays in reach while the panel scrolls */
.floating .grip {
  position: sticky;
  top: -10px;
  z-index: 1;
  margin: -10px -14px 0;
  padding: 10px 14px 4px;
  background: var(--bg-elev);
}
.grip {
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.grip:active {
  cursor: grabbing;
}
.fold-btn {
  margin-left: auto;
  padding: 2px 4px;
  border: 0;
  background: none;
  color: var(--muted);
  cursor: pointer;
}
.fold-btn:hover {
  color: var(--ink);
}
.floating.folded .stitle {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.92rem;
}
/* a demo on the whole screen */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  /* `start` would shrink a fixed box to its content */
  align-self: stretch;
  max-height: none;
  align-content: start;
  padding: max(16px, env(safe-area-inset-top)) 16px 24px;
  border: 0;
  border-radius: 0;
}
.overlay .drawing {
  justify-self: center;
  width: 100%;
  max-width: 420px;
}
.kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-ink);
}
.steps {
  display: flex;
  gap: 3px;
}
.steps i {
  width: 10px;
  height: 3px;
  border-radius: 2px;
  background: var(--rule);
  transition: background 0.3s;
}
.steps i.here {
  background: var(--accent);
}
.stitle {
  font-weight: 600;
  font-size: 1rem;
  animation: fade 0.3s ease-out;
}
.drawing {
  margin: 2px 0;
}
.explain {
  display: grid;
  gap: 6px;
  align-content: start;
  min-height: 7.5em;
  font-size: 0.9rem;
  line-height: 1.68;
}
.caption {
  margin: 0;
  color: var(--ink-2);
  animation: fade 0.3s ease-out;
}
.term {
  animation: fade 0.2s ease-out;
}
.note {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--muted);
}
.top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted);
  margin-bottom: 2px;
}
.trail {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 6px;
  min-width: 0;
}
.step {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
}
button.step {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
button.step:hover {
  color: var(--accent-ink);
}
.step.here {
  color: var(--ink);
}
.sep {
  color: var(--faint);
}
.close {
  margin-left: auto;
  padding: 0 2px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.close:hover {
  color: var(--ink);
}
.watch {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 5px 12px;
  border: 1px solid var(--accent);
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: 0.85rem;
  cursor: pointer;
}
.watch .mono {
  font-size: 11px;
  opacity: 0.75;
}
.watch:hover {
  background: var(--bg-elev);
}
.controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--muted);
}
.controls button {
  padding: 1px 8px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--bg-elev);
  cursor: pointer;
}
.controls button:disabled {
  opacity: 0.4;
  cursor: default;
}
.controls .count {
  min-width: 3em;
  text-align: center;
}
.controls .pp {
  margin-left: 4px;
}
.controls .close {
  margin-left: auto;
  border: 0;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stitle,
  .caption,
  .term {
    animation: none;
  }
}
</style>
